# =============================================================================
# alb-host — a second hostname on an ALB that another stack owns
# =============================================================================
# The `alb` module creates a load balancer. This one does not: it attaches one
# more hostname to a listener that already exists, so a second environment can
# share the load balancer instead of paying for its own.
#
#   api.dev.<domain> → host-header rule → this target group → dev ECS service
#
# What stays separate is everything that carries data: target group, ECS
# service, database, cache, secrets. What is shared is the $17/month of idle
# load balancer in front of them.
#
# The certificate is two-phase for the same reason as the `alb` module — ACM
# validation records live in Cloudflare, which is not Terraform-managed here:
#   1. Apply with enable_https = false → the certificate is requested and its
#      validation records appear in the outputs.
#   2. Add the CNAMEs in Cloudflare, wait for ISSUED, then apply with
#      enable_https = true to attach it to the listener.
#
# The host RULE is not part of that staging, and cannot be: ECS refuses to
# create a service against a target group with no associated load balancer
# ("InvalidParameterException: The target group ... does not have an associated
# load balancer"), and in an ALB a target group is associated by being the
# target of a listener rule. So the rule comes first, always.
#
# That ordering is also the safe one. A rule without a certificate fails closed:
# the hostname has no SNI certificate, so the TLS handshake for it cannot
# complete and no request is ever routed. The reverse — a certificate without a
# rule — would terminate TLS successfully for this hostname and then hand the
# request to the listener's DEFAULT action, which belongs to the other
# environment. Requests for api.dev.<domain> would be answered by production.

resource "aws_lb_target_group" "this" {
  name        = var.name
  port        = var.container_port
  protocol    = "HTTP"
  vpc_id      = var.vpc_id
  target_type = "ip"

  health_check {
    path                = var.health_check_path
    matcher             = "200"
    interval            = 30
    timeout             = 5
    healthy_threshold   = 2
    unhealthy_threshold = 3
  }

  deregistration_delay = 30
}

# ---- ACM certificate (validated via DNS records added in Cloudflare) ---------

resource "aws_acm_certificate" "this" {
  domain_name       = var.host
  validation_method = "DNS"

  lifecycle {
    create_before_destroy = true
  }
}

# ---- Attachment to the shared listener ---------------------------------------

# Created unconditionally: this is what associates the target group with the
# load balancer, without which no ECS service can use it.
#
# It cannot affect the hostnames the other environment serves. A listener rule
# is evaluated only after TLS, and only for requests whose Host header matches
# the condition below — so production traffic, which carries a different Host,
# never reaches it. The listener's default action is untouched.
resource "aws_lb_listener_rule" "host" {
  listener_arn = var.listener_arn
  priority     = var.rule_priority

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.this.arn
  }

  condition {
    host_header {
      values = [var.host]
    }
  }
}

# Phase 2. Until this exists the hostname has no SNI certificate and its
# handshake fails, which is the correct behaviour for a hostname whose DNS
# record may not exist yet either.
resource "aws_lb_listener_certificate" "this" {
  count = var.enable_https ? 1 : 0

  listener_arn    = var.listener_arn
  certificate_arn = aws_acm_certificate.this.arn
}
