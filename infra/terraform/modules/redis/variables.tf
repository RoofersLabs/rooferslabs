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
  type = list(string)
}

variable "engine_version" {
  type    = string
  default = "7.1"
}

variable "node_type" {
  type    = string
  default = "cache.t4g.micro"
}

variable "replicas_per_node" {
  description = "Read replicas (0 = single node, no failover)."
  type        = number
  default     = 0
}

variable "snapshot_retention_days" {
  type    = number
  default = 1
}

variable "apply_immediately" {
  type    = bool
  default = false
}
