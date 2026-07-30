variable "name" {
  type = string
}

variable "vpc_id" {
  type = string
}

variable "private_subnet_ids" {
  type = list(string)
}

variable "allowed_security_group_ids" {
  description = "Security groups permitted to reach PostgreSQL (the API service). Empty for an instance with no in-VPC compute."
  type        = list(string)
  default     = []
}

variable "allowed_cidr_blocks" {
  description = <<-EOT
    CIDRs permitted to reach PostgreSQL directly. Empty in production, where
    the only source is a security group.

    Used by the development instance, which has no in-VPC compute to name: the
    only client is a workstation on the public internet. Keep these to single
    addresses. Anything wider than a /32 should be justified in the tfvars file
    that sets it.
  EOT
  type        = list(string)
  default     = []

  validation {
    condition     = !contains(var.allowed_cidr_blocks, "0.0.0.0/0")
    error_message = "0.0.0.0/0 would expose PostgreSQL to the entire internet behind only a password. Use specific addresses."
  }
}

variable "publicly_accessible" {
  description = <<-EOT
    Give the instance a public endpoint. False everywhere that has in-VPC
    compute — production is unreachable from outside the VPC and stays that way.

    True only for the development instance, whose entire purpose is to be
    reachable from a laptop with no bastion or VPN. Turning this on also
    attaches a parameter group with rds.force_ssl = 1, so the endpoint refuses
    plaintext connections.
  EOT
  type        = bool
  default     = false
}

variable "engine_version" {
  type    = string
  default = "16"
}

variable "instance_class" {
  type    = string
  default = "db.t4g.micro"
}

variable "database_name" {
  type    = string
  default = "rooferslabs"
}

variable "master_username" {
  type    = string
  default = "rooferslabs"
}

variable "allocated_storage_gb" {
  type    = number
  default = 20
}

variable "max_allocated_storage_gb" {
  description = "Storage autoscaling ceiling."
  type        = number
  default     = 100
}

variable "multi_az" {
  type    = bool
  default = false
}

variable "backup_retention_days" {
  type    = number
  default = 7
}

variable "deletion_protection" {
  type    = bool
  default = true
}

variable "apply_immediately" {
  type    = bool
  default = false
}

variable "performance_insights" {
  type    = bool
  default = false
}
