// Import necessary libraries
import sharp from 'sharp';
import path from 'path';
import { S3Client, GetObjectCommand, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'; // Import necessary functionality from the AWS SDK v3

// Import environment variables
let region = process.env.AWS_S3_REGION;
let destinationBucket = process.env.AWS_DESTINATION_BUCKET;

// Create a new S3 client
const client = new S3Client({region: region});

// Define a function to extract image data from an S3 event record
// File should always be written to bucket into the root as UUID + extension
function getImageMetadata(record) {
	const fileName = path.parse(record.s3.object.key).name; // Get the file name from the key, which will be used to set the eventual directory
	const fileExt = path.parse(record.s3.object.key).ext; // Get the file extension from the key
	return { fileName, fileExt }; // Return an object with the file name, path, and extension
};

// Define an async function to fetch image data from S3
async function getImageObject(record) {
	const imageData = Buffer.concat( // Concatenate the chunks of the image data stream into a buffer
		await (
	   	await client // Use the S3 client to get the image data
				.send(new GetObjectCommand({
					Bucket: record.s3.bucket.name, // Get the bucket name from the S3 event record
					Key: record.s3.object.key // Get the object key (i.e., the file path) from the S3 event record
				}))
		).Body.toArray()
	)
	return imageData // Return the image data buffer
};

// Define an async function to save processed image data back to S3
async function saveImageToS3(imageData, filePath, fileName, fileExt, imageType) {
	const putParam = new PutObjectCommand({ // Create a PutObjectCommand object to write the image data back to S3
		Body: imageData,
		Bucket: destinationBucket, // Use the destination bucket specified in the environment variables
		Key: `${filePath}${fileName}_${imageType}${fileExt}`, // Construct the file path and name for the processed image
		CacheControl: "max-age=3600",
		ContentType: `image/${fileExt.substring(1)}`, // Set the content type based on the file extension
	});
	try {
		const response = await client.send(putParam); // Use the S3 client to write the image data back to S3
		const result = await response.Body; // Get the result from the response body
		console.log(`put${imageType}Result: ${JSON.stringify(result)}`); // Log the result
	} catch (err) {
		console.error(err); // Log any errors that occur
	};
};

// Define an async function to the ingested object from the source S3 bucket
async function deleteImageFromS3(record) {
   const deleteParam = new DeleteObjectCommand({
      Bucket: record.s3.bucket.name, // Get the bucket name from the S3 event record
      Key: record.s3.object.key // Get the object key (i.e., the file path) from the S3 event record
   });

   try {
     const response = await client.send(deleteParam); // Use the S3 client to trigger the delete in S3
     console.log(response);  // Log the result
   } catch (err) {
     console.error(err);  // Log any errors that occur
   }
 };

// Main Lambda Function
export const handler = async (event) => {

	const applicableExtensions = ['.jpg','.jpeg','.png','.webp','.gif','.avif','.tiff','.svg'] // List of applicable file extensions

	console.log(JSON.stringify(event)); // Print event to console for debugging purposes

	const records = event.Records; // Get records from event

   // Loop through each record
	const size = records.length;
	for (let index = 0; index < size; index++) {
	  const record = records[index];
	  console.log(record); // Print record to console for debugging purposes
	  const { fileName, fileExt } = getImageMetadata(record); // Get the file metadata from record 
     const filePath = fileName + '/' // Set the future filepath for this object in S3

	  if (applicableExtensions.includes(fileExt)) { // If file extension is applicable per the array defined proceed with processing the image

		const imageObject = await getImageObject(record); // Get image data

      // SHARP SETUPS
      // Here we will define all the sharp work we want to happen. These are 2 basic default options for square resizes.
      // If you wish to add more, simply define their params using the sharp documentation (see: https://sharp.pixelplumbing.com/api-constructor)
      // Then , once added, you will need to add the resize definition to the promises array `const promises = [resizeToThumbnail, resizeToCover];`
      // And then add a new `saveImageToS3(result[**ITERANT**], filePath, fileName, fileExt, "**NEW-TYPE**"),` to the `await Promise.all` block 

		const resizeToThumbnail = sharp(imageObject) // Create thumbnail version of image using Sharp
		  .resize({
			width: 300,
			height: 300,
			fit: sharp.fit.cover,
		  })
		  .withMetadata()
		  .toBuffer();

		const resizeToCover = sharp(imageObject) // Create cover version of image using Sharp
		  .resize({
			width: 800,
			height: 800,
			fit: sharp.fit.cover,
		  })
		  .withMetadata()
		  .toBuffer();

		const promises = [resizeToThumbnail, resizeToCover]; // Store promises in an array
		const result = await Promise.all(promises); // Wait for all promises to be fulfilled

		await Promise.all([ // Save the original and final images to the .env defined S3 bucket
        saveImageToS3(imageObject, filePath, fileName, fileExt, "original"), // Save the original image to the final S3 location
		  saveImageToS3(result[0], filePath, fileName, fileExt, "thumbnail"), // Save the thumbnail image to the final S3 location
		  saveImageToS3(result[1], filePath, fileName, fileExt, "coverphoto"), // Save the cover image to the final S3 location
        deleteImageFromS3(record), // Delete the original image to the source S3 location
		]);

	  } else {
		console.log(`${fileExt} is not a valid format for sharp`)
	  }
	}
  };