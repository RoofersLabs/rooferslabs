# =============================================================================
# ALB — public load balancer for the API, listeners, ACM certificate
# =============================================================================
# The ALB fronts the API service only (the frontend is on S3 + CloudFront):
#   api.<domain> → API target group (ECS, port 4000)
#
# HTTPS is a two-phase setup because ACM DNS validation records live in
# Cloudflare (managed outside Terraform):
#   1. Apply with enable_https = false → ALB serves HTTP; the ACM certificate
#      is requested and its validation records appear in the outputs.
#   2. Add the CNAME validation records in Cloudflare, wait for the cert to
#      issue, then apply with enable_https = true.

resource "aws_security_group" "alb" {
  name        = "${var.name}-alb"
  description = "ALB ingress"
  vpc_id      = var.vpc_id

  ingress {
    description = "HTTP"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = var.ingress_cidr_blocks
  }

  ingress {
    description = "HTTPS"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = var.ingress_cidr_blocks
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = { Name = "${var.name}-alb" }
}

resource "aws_lb" "this" {
  name               = var.name
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets            = var.public_subnet_ids

  # Twilio media streams hold long-lived WebSockets; keep the idle timeout
  # comfortably above any silence between frames.
  idle_timeout = 300

  drop_invalid_header_fields = true
}

# ---- Target group -------------------------------------------------------------

resource "aws_lb_target_group" "api" {
  name        = "${var.name}-api"
  port        = var.api_container_port
  protocol    = "HTTP"
  vpc_id      = var.vpc_id
  target_type = "ip"

  health_check {
    path                = "/v1/health/ready"
    matcher             = "200"
    interval            = 30
    timeout             = 5
    healthy_threshold   = 2
    unhealthy_threshold = 3
  }

  deregistration_delay = 30
}

# ---- ACM certificate (validated via DNS records added in Cloudflare) ----------

resource "aws_acm_certificate" "this" {
  domain_name       = var.api_domain
  validation_method = "DNS"

  lifecycle {
    create_before_destroy = true
  }
}

# ---- Listeners ----------------------------------------------------------------

# HTTP: redirect to HTTPS once enabled; direct API forwarding before that.
resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.this.arn
  port              = 80
  protocol          = "HTTP"

  dynamic "default_action" {
    for_each = var.enable_https ? [1] : []
    content {
      type = "redirect"
      redirect {
        port        = "443"
        protocol    = "HTTPS"
        status_code = "HTTP_301"
      }
    }
  }

  dynamic "default_action" {
    for_each = var.enable_https ? [] : [1]
    content {
      type             = "forward"
      target_group_arn = aws_lb_target_group.api.arn
    }
  }
}

resource "aws_lb_listener" "https" {
  count = var.enable_https ? 1 : 0

  load_balancer_arn = aws_lb.this.arn
  port              = 443
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06"
  certificate_arn   = aws_acm_certificate.this.arn

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.api.arn
  }
}
