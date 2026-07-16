# =============================================================================
# ECS Fargate service — task definition + service behind an ALB target group
# =============================================================================
# Reused for both the API and the web (nginx) containers. Tasks run in private
# subnets with no public IPs; only the ALB can reach them.

# The service SG can be supplied by the root module (the API's SG is created
# there so RDS/Redis can whitelist it without a module cycle) or created here.
resource "aws_security_group" "this" {
  count = var.security_group_id == null ? 1 : 0

  name        = "${var.name}-svc"
  description = "Ingress from the ALB to ${var.name}"
  vpc_id      = var.vpc_id

  ingress {
    description     = "Container port from the ALB"
    from_port       = var.container_port
    to_port         = var.container_port
    protocol        = "tcp"
    security_groups = [var.alb_security_group_id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = { Name = "${var.name}-svc" }
}

locals {
  service_security_group_id = coalesce(var.security_group_id, one(aws_security_group.this[*].id))
}

resource "aws_ecs_task_definition" "this" {
  family                   = var.name
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = var.cpu
  memory                   = var.memory
  execution_role_arn       = var.execution_role_arn
  task_role_arn            = var.task_role_arn

  runtime_platform {
    operating_system_family = "LINUX"
    cpu_architecture        = "X86_64"
  }

  container_definitions = jsonencode([
    {
      name      = var.container_name
      image     = "${var.image_repository_url}:${var.image_tag}"
      essential = true

      portMappings = [
        {
          containerPort = var.container_port
          protocol      = "tcp"
        }
      ]

      environment = [
        for key, value in var.environment : { name = key, value = value }
      ]

      secrets = [
        for key, arn in var.secrets : { name = key, valueFrom = arn }
      ]

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = var.log_group_name
          "awslogs-region"        = var.region
          "awslogs-stream-prefix" = var.container_name
        }
      }
    }
  ])
}

resource "aws_ecs_service" "this" {
  name            = var.name
  cluster         = var.cluster_arn
  task_definition = aws_ecs_task_definition.this.arn
  desired_count   = var.desired_count
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = var.private_subnet_ids
    security_groups  = [local.service_security_group_id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = var.target_group_arn
    container_name   = var.container_name
    container_port   = var.container_port
  }

  health_check_grace_period_seconds = var.health_check_grace_period_seconds
  enable_execute_command            = true

  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }

  deployment_maximum_percent         = 200
  deployment_minimum_healthy_percent = var.desired_count > 1 ? 100 : 0

  # The deploy script pushes a new image and forces a redeployment; the task
  # definition itself only changes when configuration changes.
  lifecycle {
    ignore_changes = [desired_count]
  }
}
