terraform {
  required_version = ">= 1.6"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 5.40"
    }
    random = {
      source  = "hashicorp/random"
      version = ">= 3.6"
    }
  }

  # Remote state (recommended once you have more than one operator).
  # Create the bucket once, then uncomment and `terraform init -migrate-state`:
  #
  # backend "s3" {
  #   bucket       = "rooferslabs-terraform-state"   # must be globally unique
  #   key          = "production/terraform.tfstate"
  #   region       = "us-east-1"
  #   use_lockfile = true
  #   encrypt      = true
  # }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "rooferslabs"
      Environment = var.environment
      ManagedBy   = "terraform"
    }
  }
}

# CloudFront ACM certificates must live in us-east-1, regardless of the primary
# region. Used by the frontend-cdn module for the SPA certificate.
provider "aws" {
  alias  = "us_east_1"
  region = "us-east-1"

  default_tags {
    tags = {
      Project     = "rooferslabs"
      Environment = var.environment
      ManagedBy   = "terraform"
    }
  }
}
