variable "name" {
  description = "Name prefix for all networking resources (e.g. rooferslabs-production)."
  type        = string
}

variable "vpc_cidr" {
  description = "CIDR block for the VPC."
  type        = string
  default     = "10.0.0.0/16"
}

variable "az_count" {
  description = "Number of availability zones to spread subnets across."
  type        = number
  default     = 2
}

variable "enable_nat_gateway" {
  description = <<-EOT
    Provision NAT so private subnets have outbound internet.

    True for any environment running compute (production). False for an
    environment whose only resource is a publicly-addressable database, which
    needs no egress — this is the difference between a free development VPC and
    a ~$32/month one.
  EOT
  type        = bool
  default     = true
}

variable "single_nat_gateway" {
  description = "Use one NAT gateway for all private subnets (cheaper) instead of one per AZ (more resilient)."
  type        = bool
  default     = true
}
