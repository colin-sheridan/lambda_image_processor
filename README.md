
# Lambda Image Process

A small node.js lambda fucntion to resize images places in an AWS S3 bucket to a destination AWS S3 bucket


## Usage

Place an image w/ a unique ID (UUID) into your defined source bucket, and the code will process the image into a few defined sizes and output them to a folder in your destination bucket with the structure

```bash
    UUID/
        |_ UUID_original.ext
        |_ UUID_definedsize1.ext
        |_ UUID_definedsize2.ext
```

## Installation
First Run:
```bash
npm install
```

To install this project to lambda, you must first create a lambda layer (see: https://docs.aws.amazon.com/lambda/latest/dg/configuration-layers.html)

The basics of creating a layer can be done with:

```bash
  mkdir image_processor && cd image_processor
  npm init -y
  npm install --arch=x64 --platform=linux --prefix nodejs sharp
  zip -r9 sharplayer ../image_processor
```


## Deployment

Create a new Node.js 18.x / x86_64 Lambda function and copy the contents of 'index.mjs' to the index.mjs in the exiting index.mjs in the function. Scroll to the bottom of the code tab to "Layers" and click "Add a Layer". Select "Custom Layers" and chose you previously uploaded layer.

Next, Create 2 S3 buckets (1 for ingest, and 1 as the final destination, and it is important to make 2 so you don't get caught in an expensive loop) and record their ARNs / names.

You will need to create the following IAM policy and assign it to the lambda exection role, using the destination bucket ARN / name under "Resources":

```
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "VisualEditor0",
            "Effect": "Allow",
            "Action": [
                "logs:CreateLogStream",
                "logs:CreateLogGroup",
                "logs:PutLogEvents"
            ],
            "Resource": "*"
        },
        {
            "Sid": "VisualEditor1",
            "Effect": "Allow",
            "Action": [
                "s3:PutObject",
                "s3:GetObject",
                "s3:DeleteObject",
                "s3:PutObjectAcl"
            ],
            "Resource": [
                "arn:aws:s3:::DESTINATION-BUCKET-NAME/*",
                "arn:aws:s3:::DESTINATION-BUCKET-NAME/*"
            ]
        }
    ]
}
```

Finally, in the source bucket, navigate to "Properties > Event notification" and click "Create event notification". Give it a basic name, and select "All object create events" as the Event Type. Finally, Select "Lambda function" as you destination and select your lambda function


## Environment Variables

To run this project, you will need to add the following environment variables to your lambda function ("Configuration > Environment variables > Edit")

`AWS_DESTINATION_BUCKET`:
Destination Bucket Name

`AWS_S3_REGION`:
Destination Bucket Region

