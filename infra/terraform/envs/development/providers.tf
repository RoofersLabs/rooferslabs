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

  # ---- Remote state -----------------------------------------------------------
  # A separate state object from production's, under the same bucket. Separate
  # keys are what make the two environments independent: no development apply
  # can read, lock, or write production's state, so no development apply can
  # plan a change against a production resource.
  #
  # Enable after `cd ../../bootstrap && terraform apply`:
  #
  #   backend "s3" {
  #     bucket       = "rooferslabs-terraform-state-462292557780"
  #     key          = "development/terraform.tfstate"
  #     region       = "us-east-1"
  #     use_lockfile = true
  #     encrypt      = true
  #   }
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
