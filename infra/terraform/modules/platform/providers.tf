# CloudFront's ACM certificates must live in us-east-1 regardless of the primary
# region, so this module needs both provider configurations passed in by the
# environment root and forwards them to frontend-cdn.

terraform {
  required_version = ">= 1.6"

  required_providers {
    aws = {
      source                = "hashicorp/aws"
      version               = ">= 5.40"
      configuration_aliases = [aws.us_east_1]
    }
    random = {
      source  = "hashicorp/random"
      version = ">= 3.6"
    }
  }
}
