import json
import boto3
import uuid
from datetime import datetime
from botocore.exceptions import ClientError
import logging
from PIL import Image
from PIL.ExifTags import TAGS
import io
import os
import re
from decimal import Decimal
import time
import json
import urllib.parse
import urllib.request

# In-process cache + throttling
_geocode_cache = {}
_last_geocode_ts = 0

# Configure logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)
logger.info("==== Lambda START ====")
# Initialize S3 client
s3_client = boto3.client('s3')

# Initialize DynamoDB
dynamodb = boto3.resource('dynamodb')
GALLERIES_TABLE_NAME = os.getenv('GALLERIES_TABLE', 'Galleries')
GALLERY_PHOTOS_TABLE_NAME = os.getenv('GALLERY_PHOTOS_TABLE', 'GalleryPhotos')
PHOTO_RATINGS_TABLE_NAME = os.getenv('PHOTO_RATINGS_TABLE', 'PhotoRatings')
tbl_galleries = dynamodb.Table(GALLERIES_TABLE_NAME)
tbl_gallery_photos = dynamodb.Table(GALLERY_PHOTOS_TABLE_NAME)
tbl_photo_ratings = dynamodb.Table(PHOTO_RATINGS_TABLE_NAME)

# Configuration
BUCKET_NAME = 'haophotography'
METADATA_KEY = 'galleries/metadata.json'


def lambda_handler(event, context):
    """
    Main Lambda handler for gallery management operations
    """
    logger.info(f"Received event: {event}")
    # Parse the HTTP method and path
    http_method = event.get('httpMethod', 'GET')
    path = event.get('path', '')
    
    # Parse request body if present
    body = {}
    if event.get('body'):
        body = json.loads(event.get('body', '{}'))
    
    # Parse query parameters
    query_params = event.get('queryStringParameters') or {}
    
    logger.info(f"Body: {body}")
    logger.info(f"Query params: {query_params}")
    # CORS preflight support
    if http_method == 'OPTIONS':
        return create_response(200, {'ok': True})
        
    # Route to appropriate handler - check specific actions first
    if http_method == 'POST' and '/galleries' in path:
        action_param = query_params.get('action') if query_params else None
        
        # Actions under POST /galleries
        if action_param == 'upload_photos':
            logger.info("Routing to upload_photos()")
            gallery_id = query_params.get('id')
            if gallery_id:
                return upload_photos(gallery_id, body)
            else:
                return create_response(400, {'error': 'Gallery ID required for photo upload'})
        elif action_param == 'update_galleries_metadata':
            logger.info("Routing to update_galleries_metadata()")
            return update_galleries_metadata()
        elif action_param == 'update_GalleryPhotos':
            logger.info("Routing to update_GalleryPhotos()")
            return update_GalleryPhotos(body)
        elif action_param == 'delete_photo':
            logger.info("Routing to delete_photo()")
            gallery_id = query_params.get('id')
            if not gallery_id:
                return create_response(400, {'error': 'Gallery ID required for delete'})
            return delete_photo(gallery_id, body)
        elif action_param == 'rate_photo':
            logger.info("Routing to rate_photo()")
            return rate_photo(body)
        elif action_param == 'get_photo_rating':
            logger.info("Routing to get_photo_rating()")
            return get_photo_rating(query_params)
        elif action_param == 'update_sort_order':
            logger.info("Routing to update_gallery_sort_order()")
            return update_gallery_sort_order(body)
        elif action_param == 'update_photo_sort_order':
            logger.info("Routing to update_photo_sort_order()")
            return update_photo_sort_order(body)
        elif action_param == 'get_upload_urls':
            logger.info("Routing to get_upload_urls()")
            gallery_id = query_params.get('id')
            if gallery_id:
                return get_upload_urls(gallery_id, body)
            else:
                return create_response(400, {'error': 'Gallery ID required for getting upload URLs'})
        else:
            logger.info("Routing to create_gallery()")
            return create_gallery(body)
    elif http_method == 'GET' and '/galleries' in path:
        action_param = query_params.get('action') if query_params else None
        
        if action_param == 'get_photo_rating':
            logger.info("Routing to get_photo_rating()")
            return get_photo_rating(query_params)
        else:
            gallery_id = query_params.get('id')
            if gallery_id:
                return get_gallery(gallery_id)
            else:
                return list_galleries()

    elif http_method == 'PUT' and '/galleries' in path:
        return update_gallery(body)
    elif http_method == 'DELETE' and '/galleries' in path:
        gallery_id = query_params.get('id')
        return delete_gallery(gallery_id)
    else:
        return create_response(400, {'error': 'Invalid endpoint or method'})

def create_gallery(gallery_data):
    """
    Create a new gallery
    """
    try:
        # Validate required fields
        required_fields = ['name', 'continent', 'country', 'years']
        for field in required_fields:
            if field not in gallery_data:
                return create_response(400, {'error': f'Missing required field: {field}'})
        
        # Validate years field
        if not gallery_data.get('years') or len(gallery_data['years']) == 0:
            return create_response(400, {'error': 'At least one year must be selected'})
        
        # Ensure years are strings for DynamoDB compatibility
        years = [str(year) for year in gallery_data['years']]
        
        # Check for duplicate gallery by scanning DynamoDB (same name, continent, country
        scan = tbl_galleries.scan()
        existing = [
            it for it in scan.get('Items', [])
            if (it.get('name', '').strip().lower() == gallery_data['name'].strip().lower()
                and it.get('continent') == gallery_data['continent']
                and it.get('country') == gallery_data['country'])
        ]
        if existing:
            return create_response(400, {
                'error': 'Gallery name already exists',
                'message': f'A gallery with the name "{gallery_data["name"].strip()}" already exists in {gallery_data["country"]}, {gallery_data["continent"]}. Please choose a different name.'
            })
        
        # Generate unique ID
        gallery_id = str(uuid.uuid4())
        current_time = datetime.utcnow().isoformat() + 'Z'
        
        # Get the next sort order for the new gallery
        try:
            # Scan for the highest current sort order
            scan_response = tbl_galleries.scan(
                ProjectionExpression='sortOrder',
                FilterExpression='attribute_exists(sortOrder)'
            )
            existing_sort_orders = [item.get('sortOrder', 0) for item in scan_response.get('Items', [])]
            next_sort_order = max(existing_sort_orders) + 1 if existing_sort_orders else 1
            logger.info(f"Next sort order for new gallery: {next_sort_order}")
        except Exception as e:
            logger.warning(f"Error getting next sort order, defaulting to 1: {str(e)}")
            next_sort_order = 1
        
        # Create gallery record in DynamoDB (source of truth)
        gallery_item = {
            'galleryId': gallery_id,
            'name': gallery_data['name'].strip(),
            'continent': gallery_data['continent'],
            'country': gallery_data['country'],
            'description': gallery_data.get('description', '').strip(),
            # Years are required; normalize to list and ensure they are strings
            'years': years,
            'photoCount': 0,
            'sortOrder': next_sort_order,
            'createdAt': current_time,
            'updatedAt': current_time
        }
        
        # Add coordinates if provided
        if 'latitude' in gallery_data and 'longitude' in gallery_data:
            # Convert coordinates to Decimal for DynamoDB compatibility
            gallery_item['latitude'] = Decimal(str(gallery_data['latitude']))
            gallery_item['longitude'] = Decimal(str(gallery_data['longitude']))
            logger.info(f"Added coordinates for gallery {gallery_item['name']}: {gallery_data['latitude']}, {gallery_data['longitude']}")
        else:
            # Try to geocode the location if coordinates not provided
            try:
                latlon = geocode_place(gallery_data['name'], gallery_data['country'])
                if latlon:
                    gallery_item['latitude'] = Decimal(str(latlon[0]))
                    gallery_item['longitude'] = Decimal(str(latlon[1]))
                    logger.info(f"Geocoded coordinates for gallery {gallery_item['name']}: {latlon[0]}, {latlon[1]}")
                else:
                    logger.warning(f"Could not geocode coordinates for gallery {gallery_item['name']}")
            except Exception as e:
                logger.error(f"Error geocoding gallery {gallery_item['name']}: {str(e)}")
        tbl_galleries.put_item(Item=gallery_item)

        # Create S3 folder
        try:
            s3_client.put_object(Bucket=BUCKET_NAME, Key=f"galleries/{gallery_item['continent']}/{gallery_item['country']}/{gallery_item['name']}/", Body=b"")
            logger.info(f"Created S3 folder for gallery {gallery_item['name']}")
        except Exception as s3_error:
            logger.warning(f"Failed to create S3 folder for gallery {gallery_item['name']}: {str(s3_error)}")
            # Continue with gallery creation even if S3 folder creation fails

        # Build response object
        logger.info(f"Successfully created gallery in DynamoDB: {gallery_item['name']}")
        
        response_gallery = {
            'id': gallery_id,
            'name': gallery_item['name'],
            'continent': gallery_item['continent'],
            'country': gallery_item['country'],
            'description': gallery_item['description'],
            'years': gallery_item['years'],
            'photos': [],
            'photoCount': 0,
            'sortOrder': gallery_item['sortOrder'],
            'createdAt': current_time,
            'updatedAt': current_time
        }
        
        # Add coordinates to response if available
        if 'latitude' in gallery_item and 'longitude' in gallery_item:
            # Convert Decimal back to float for JSON response
            response_gallery['latitude'] = float(gallery_item['latitude'])
            response_gallery['longitude'] = float(gallery_item['longitude'])
        
        return create_response(201, {
            'message': 'Gallery created successfully',
            'gallery': response_gallery
        })
    except Exception as e:
        logger.error(f"Error creating gallery: {str(e)}")
        logger.error(f"Gallery data received: {gallery_data}")
        import traceback
        logger.error(f"Full traceback: {traceback.format_exc()}")
        return create_response(500, {'error': 'Failed to create gallery', 'details': str(e)})

def list_galleries():
    """
    List all galleries in manage gallery page
    """
    logger.info("Listing galleries from DynamoDB table")
    scan = tbl_galleries.scan()
    items = scan.get('Items', [])

    # Sort galleries by sortOrder if available, otherwise by creation date
    try:
        items.sort(key=lambda x: (x.get('sortOrder', float('inf')), x.get('createdAt', '')))
        logger.info(f"Sorted {len(items)} galleries by sortOrder")
    except Exception as e:
        logger.warning(f"Error sorting galleries by sortOrder, using creation date: {str(e)}")
        items.sort(key=lambda x: x.get('createdAt', ''))

    return create_response(200, {
        'galleries': items,
        'total': len(items),
        'lastUpdated': datetime.utcnow().isoformat() + 'Z'
    })

def delete_gallery(gallery_id):
    """
    Delete a gallery in manage gallery page
    """
    try:
        # Get gallery info first
        gallery_response = get_gallery(gallery_id)
        if gallery_response['statusCode'] != 200:
            return gallery_response
        
        gallery = json.loads(gallery_response['body'])
        
        # 1) Delete gallery folder and all contents from S3
        gallery_prefix = f"galleries/{gallery['continent']}/{gallery['country']}/{gallery['name']}/"
        
        objects_to_delete = []
        try:
            paginator = s3_client.get_paginator('list_objects_v2')
            for page in paginator.paginate(Bucket=BUCKET_NAME, Prefix=gallery_prefix):
                for obj in page.get('Contents', []):
                    objects_to_delete.append({'Key': obj['Key']})
            if objects_to_delete:
                s3_client.delete_objects(Bucket=BUCKET_NAME, Delete={'Objects': objects_to_delete})
        except Exception as e:
            logger.warning(f"S3 delete error for prefix {gallery_prefix}: {e}")

        # 2) Delete all photo items from DynamoDB (GalleryPhotos)
        ddb_photos_deleted = 0
        try:
            from boto3.dynamodb.conditions import Key
            q = tbl_gallery_photos.query(KeyConditionExpression=Key('galleryId').eq(str(gallery_id)))
            items = q.get('Items', [])
            if items:
                with tbl_gallery_photos.batch_writer(overwrite_by_pkeys=['galleryId', 'photoId']) as batch:
                    for it in items:
                        batch.delete_item(Key={'galleryId': str(gallery_id), 'photoId': str(it.get('photoId') or it.get('photoNumber'))})
                        ddb_photos_deleted += 1
        except Exception as e:
            logger.warning(f"DynamoDB delete GalleryPhotos error for {gallery_id}: {e}")

        # 3) Delete the gallery item itself from DynamoDB (Galleries)
        ddb_gallery_deleted = False
        try:
            tbl_galleries.delete_item(Key={'galleryId': str(gallery_id)})
            ddb_gallery_deleted = True
        except Exception as e:
            logger.warning(f"DynamoDB delete Galleries error for {gallery_id}: {e}")

        logger.info(f"Successfully deleted gallery {gallery_id}: S3 objects={len(objects_to_delete)}, photos={ddb_photos_deleted}, galleryItem={ddb_gallery_deleted}")
        return create_response(200, {
            'message': 'Gallery deleted successfully',
            's3DeletedObjects': len(objects_to_delete),
            'ddbPhotosDeleted': ddb_photos_deleted,
            'ddbGalleryDeleted': ddb_gallery_deleted
        })
        
    except Exception as e:
        logger.error(f"Error deleting gallery {gallery_id}: {str(e)}")
        return create_response(500, {'error': 'Failed to delete gallery', 'details': str(e)})

def get_gallery(gallery_id):
    """
    Get a specific gallery by ID from DynamoDB
    """
    try:
        # Read gallery basic information from galleries table
        resp = tbl_galleries.get_item(Key={'galleryId': str(gallery_id)})
        if 'Item' not in resp:
            return create_response(404, {'error': 'Gallery not found'})

        gallery = resp['Item']
        logger.info(f"Gallery: {gallery}")

        # Query photos for this gallery
        from boto3.dynamodb.conditions import Key
        photos_resp = tbl_gallery_photos.query(
            KeyConditionExpression=Key('galleryId').eq(str(gallery_id)),
            ScanIndexForward=True
        )
        photos = photos_resp.get('Items', [])
        
        # Sort photos by sortOrder if available, otherwise by photoId
        photos.sort(key=lambda x: (x.get('sortOrder', float('inf')), x.get('photoId', '')))
        
        # Ensure all photos have sortOrder (for backward compatibility)
        for i, photo in enumerate(photos):
            if 'sortOrder' not in photo:
                photo['sortOrder'] = i + 1
                # Update the photo in DynamoDB with sortOrder
                try:
                    tbl_gallery_photos.update_item(
                        Key={'galleryId': str(gallery_id), 'photoId': photo['photoId']},
                        UpdateExpression='SET sortOrder = :sort_order',
                        ExpressionAttributeValues={
                            ':sort_order': i + 1
                        }
                    )
                    logger.info(f"Added sortOrder {i + 1} to photo {photo['photoId']}")
                except Exception as e:
                    logger.warning(f"Failed to update sortOrder for photo {photo['photoId']}: {e}")
        
        gallery['photos'] = photos

        # Ensure compatibility fields
        gallery['id'] = gallery.get('galleryId', str(gallery_id))
        gallery['photoCount'] = len(gallery['photos'])

        # If coverPhotoURL is missing and there are photos, automatically set the first photo's thumbnail URL
        if not gallery.get('coverPhotoURL') and gallery['photos']:
            first_photo = gallery['photos'][0]
            first_thumbnail = first_photo.get('thumbnail')
            if first_thumbnail:
                tbl_galleries.update_item(
                    Key={'galleryId': str(gallery_id)},
                    UpdateExpression="SET coverPhotoURL = if_not_exists(coverPhotoURL, :cid), updatedAt = :now",
                    ExpressionAttributeValues={
                        ':cid': first_thumbnail,
                        ':now': datetime.utcnow().isoformat() + 'Z'
                    }
                )
                gallery['coverPhotoURL'] = first_thumbnail

        return create_response(200, gallery)
                        
    except Exception as e:
        logger.error(f"Error getting gallery {gallery_id}: {str(e)}")
        return create_response(500, {'error': 'Failed to get gallery', 'details': str(e)})
        

def update_gallery(gallery_data):
    """Update an existing gallery (DynamoDB is source of truth).
    If name/continent/country changed, move S3 folder (copy-then-delete) and update photo s3Key/image/thumbnail.
    Also supports setting cover photo.
    """
    try:
        logger.info(f"Starting update_gallery with data: {json.dumps(gallery_data, default=str)}")
        
        gallery_id = gallery_data.get('id')
        if not gallery_id:
            return create_response(400, {'error': 'Gallery ID is required'})
        
        logger.info(f"Updating gallery with ID: {gallery_id}")
        
        # Load current gallery from DynamoDB
        cur_resp = tbl_galleries.get_item(Key={'galleryId': str(gallery_id)})
        if 'Item' not in cur_resp:
            return create_response(404, {'error': 'Gallery not found'})
        current = cur_resp['Item']
        
        logger.info(f"Current gallery data: {json.dumps(current, default=str)}")

        # Check if this is just a cover photo update
        if gallery_data.get('action') == 'set_cover_photo':
            photo_id = gallery_data.get('photoId')
            if not photo_id:
                return create_response(400, {'error': 'photoId is required for cover photo update'})
            
            # Validate the photo belongs to the gallery and get its thumbnail URL
            from boto3.dynamodb.conditions import Key
            q = tbl_gallery_photos.query(KeyConditionExpression=Key('galleryId').eq(str(gallery_id)))
            target_photo = None
            for it in q.get('Items', []):
                if (str(it.get('photoId') or it.get('photoNumber')) == str(photo_id)):
                    target_photo = it
                    break
            
            if not target_photo:
                return create_response(404, {'error': 'Photo not found in this gallery'})
            
            # Get the thumbnail URL from the photo record
            thumbnail_url = target_photo.get('thumbnail')
            if not thumbnail_url:
                return create_response(400, {'error': 'Photo does not have a thumbnail URL'})
            
            # Update cover photo with thumbnail URL
            tbl_galleries.update_item(
                Key={'galleryId': str(gallery_id)},
                UpdateExpression="SET coverPhotoURL = :pid, updatedAt = :now",
                ExpressionAttributeValues={
                    ':pid': thumbnail_url,
                    ':now': datetime.utcnow().isoformat() + 'Z'
                }
            )
            return create_response(200, {'message': 'Cover photo updated', 'coverPhotoURL': thumbnail_url})

        # Determine proposed new values
        new_name = (gallery_data.get('name') or current.get('name') or '').strip()
        new_continent = gallery_data.get('continent') or current.get('continent')
        new_country = gallery_data.get('country') or current.get('country')
        new_description = (gallery_data.get('description') if gallery_data.get('description') is not None else current.get('description', '')).strip()
        new_years = gallery_data.get('years') if gallery_data.get('years') is not None else (current.get('years') or [])
        new_cover_photo_url = gallery_data.get('coverPhotoURL')  # Support cover photo update (can be photoId or thumbnail URL)

        # Check if any path component has changed - move S3 files if name, continent, or country changes
        path_changed = (new_name != current.get('name') or 
                       new_continent != current.get('continent') or 
                       new_country != current.get('country'))
        
        s3_objects_copied = 0
        s3_objects_deleted = 0
        photo_items_updated = 0

        # Move S3 objects if any path component has changed
        if path_changed:
            # Compute old/new S3 prefixes
            old_prefix = f"galleries/{current['continent']}/{current['country']}/{current['name']}/"
            new_prefix = f"galleries/{new_continent}/{new_country}/{new_name}/"
            
            try:
                # Ensure dest "folder" exists
                try:
                    s3_client.put_object(Bucket=BUCKET_NAME, Key=new_prefix, Body=b"")
                except Exception:
                    pass

                # Copy all objects from old to new
                paginator = s3_client.get_paginator('list_objects_v2')
                objects_to_delete = []
                for page in paginator.paginate(Bucket=BUCKET_NAME, Prefix=old_prefix):
                    for obj in page.get('Contents', []):
                        key = obj['Key']
                        new_key = new_prefix + key[len(old_prefix):]
                        # Skip folder placeholder keys during copy
                        if key.endswith('/') and key == old_prefix:
                            continue
                        s3_client.copy_object(Bucket=BUCKET_NAME, Key=new_key, CopySource={'Bucket': BUCKET_NAME, 'Key': key})
                        s3_objects_copied += 1
                        objects_to_delete.append({'Key': key})
                
                # Also delete the old folder placeholder
                objects_to_delete.append({'Key': old_prefix})
                
                if objects_to_delete:
                    s3_client.delete_objects(Bucket=BUCKET_NAME, Delete={'Objects': objects_to_delete})
                    s3_objects_deleted = len(objects_to_delete)
            except Exception as e:
                logger.error(f"Error moving S3 prefix from {old_prefix} to {new_prefix}: {e}")
                return create_response(500, {'error': 'Failed to move gallery files in S3', 'details': str(e)})

            # Update DynamoDB photo items with new s3Key/image/thumbnail
            try:
                from boto3.dynamodb.conditions import Key
                q = tbl_gallery_photos.query(KeyConditionExpression=Key('galleryId').eq(str(gallery_id)))
                base_url = f"https://{BUCKET_NAME}.s3.eu-north-1.amazonaws.com"
                for it in q.get('Items', []):
                    pid = str(it.get('photoId') or it.get('photoNumber'))
                    old_key = it.get('s3Key') or ''
                    new_key = (old_key.replace(old_prefix, new_prefix, 1) if old_key.startswith(old_prefix) else old_key)
                    new_image = f"{base_url}/{new_key}" if new_key else it.get('image')
                    # thumbnail may equal image
                    old_thumb = it.get('thumbnail') or ''
                    new_thumb = new_image if (old_thumb == it.get('image')) else (f"{base_url}/{new_key}" if old_thumb and old_thumb.startswith(f"{base_url}/{old_prefix}") else old_thumb)
                    tbl_gallery_photos.update_item(
                        Key={'galleryId': str(gallery_id), 'photoId': pid},
                        UpdateExpression="SET s3Key=:k, image=:img, thumbnail=:th, lastModified=:now",
                        ExpressionAttributeValues={
                            ':k': new_key,
                            ':img': new_image,
                            ':th': new_thumb,
                            ':now': datetime.utcnow().isoformat() + 'Z'
                        }
                    )
                    photo_items_updated += 1
            except Exception as e:
                logger.error(f"Error updating photo items for gallery {gallery_id}: {e}")
                return create_response(500, {'error': 'Failed to update photo records', 'details': str(e)})

        # Update photo names if provided
        photos_to_update = gallery_data.get('photos', [])
        logger.info(f"Photos to update: {json.dumps(photos_to_update, default=str)}")
        
        if photos_to_update:
            try:
                from boto3.dynamodb.conditions import Key
                for photo_data in photos_to_update:
                    photo_id = photo_data.get('id') or photo_data.get('photoId')
                    new_name = photo_data.get('name')
                    
                    logger.info(f"Processing photo: id={photo_id}, name={new_name}")
                    
                    if photo_id and new_name is not None:
                        # First, find the photo in DynamoDB to get the correct photoId
                        photo_query = tbl_gallery_photos.query(
                            KeyConditionExpression=Key('galleryId').eq(str(gallery_id))
                        )
                        
                        logger.info(f"Found {len(photo_query.get('Items', []))} photos in gallery")
                        
                        # Find the photo by matching id or photoId
                        target_photo = None
                        for photo_item in photo_query.get('Items', []):
                            logger.info(f"Checking photo item: {json.dumps(photo_item, default=str)}")
                            if (str(photo_item.get('photoId')) == str(photo_id) or 
                                str(photo_item.get('id')) == str(photo_id) or
                                str(photo_item.get('photoNumber')) == str(photo_id)):
                                target_photo = photo_item
                                logger.info(f"Found matching photo: {json.dumps(target_photo, default=str)}")
                                break
                        
                        if target_photo:
                            # Update photo name in DynamoDB using the correct photoId
                            actual_photo_id = str(target_photo.get('photoId') or target_photo.get('photoNumber'))
                            logger.info(f"Updating photo name for {photo_id} (actual photoId: {actual_photo_id}): {new_name}")
                            
                            tbl_gallery_photos.update_item(
                                Key={'galleryId': str(gallery_id), 'photoId': actual_photo_id},
                                UpdateExpression="SET #n=:n, lastModified=:now",
                                ExpressionAttributeNames={'#n': 'name'},
                                ExpressionAttributeValues={
                                    ':n': str(new_name).strip(),
                                    ':now': datetime.utcnow().isoformat() + 'Z'
                                }
                            )
                            photo_items_updated += 1
                            logger.info(f"Successfully updated photo name for {photo_id}")
                        else:
                            logger.warning(f"Photo with id {photo_id} not found in gallery {gallery_id}")
            except Exception as e:
                logger.error(f"Error updating photo names for gallery {gallery_id}: {e}")
                logger.error(f"Full error details: {str(e)}")
                import traceback
                logger.error(f"Traceback: {traceback.format_exc()}")
                # Don't fail the entire update, just log the error

        # Update gallery item in DynamoDB
        try:
            update_expr = "SET #n=:n, continent=:c, country=:co, description=:d, years=:y, updatedAt=:now"
            expr_vals = {
                ':n': new_name,
                ':c': new_continent,
                ':co': new_country,
                ':d': new_description,
                ':y': new_years or [],
                ':now': datetime.utcnow().isoformat() + 'Z'
            }
            expr_names = {
                '#n': 'name'
            }
            
            # Add cover photo update if provided
            if new_cover_photo_url is not None:
                # If new_cover_photo_url is a photoId (not a URL), convert it to thumbnail URL
                if not new_cover_photo_url.startswith('http'):
                    # Find the photo and get its thumbnail URL
                    from boto3.dynamodb.conditions import Key
                    q = tbl_gallery_photos.query(KeyConditionExpression=Key('galleryId').eq(str(gallery_id)))
                    target_photo = None
                    for it in q.get('Items', []):
                        if (str(it.get('photoId') or it.get('photoNumber')) == str(new_cover_photo_url)):
                            target_photo = it
                            break
                    
                    if target_photo and target_photo.get('thumbnail'):
                        new_cover_photo_url = target_photo.get('thumbnail')
                    else:
                        logger.warning(f"Could not find thumbnail URL for photo {new_cover_photo_url}")
                        new_cover_photo_url = str(new_cover_photo_url)  # Fallback to photoId
                
                update_expr += ", coverPhotoURL = :cpid"
                expr_vals[':cpid'] = str(new_cover_photo_url)
            
            tbl_galleries.update_item(
                Key={'galleryId': str(gallery_id)},
                UpdateExpression=update_expr,
                ExpressionAttributeValues=expr_vals,
                ExpressionAttributeNames=expr_names
            )
        except Exception as e:
            logger.error(f"Error updating gallery item {gallery_id}: {e}")
            return create_response(500, {'error': 'Failed to update gallery metadata', 'details': str(e)})

        updated = {
            'id': str(gallery_id),
            'galleryId': str(gallery_id),
            'name': new_name,
            'continent': new_continent,
            'country': new_country,
            'description': new_description,
            'years': new_years or [],
            'updatedAt': datetime.utcnow().isoformat() + 'Z',
            'movedS3': path_changed,
            's3ObjectsCopied': s3_objects_copied,
            's3ObjectsDeleted': s3_objects_deleted,
            'photosUpdated': photo_items_updated,
            'coverPhotoURL': new_cover_photo_url
        }

        logger.info(f"Updated gallery {gallery_id}: {json.dumps(updated)}")
        return create_response(200, {'message': 'Gallery updated successfully', 'gallery': updated})

    except Exception as e:
        logger.error(f"Error updating gallery: {str(e)}")
        return create_response(500, {'error': 'Failed to update gallery', 'details': str(e)})




def upload_photos(gallery_id, upload_data):
    """
    Upload photos to a gallery (DynamoDB + S3)
    """
    try:
        logger.info(f"Starting photo upload for gallery ID: {gallery_id}")
        
        # Get gallery information from DynamoDB
        dg = tbl_galleries.get_item(Key={'galleryId': str(gallery_id)})
        if 'Item' not in dg:
            return create_response(404, {'error': 'Gallery not found'})
        gallery = dg['Item']

        gallery_path = f"galleries/{gallery['continent']}/{gallery['country']}/{gallery['name']}"
        
        # Check upload data
        photos_data = upload_data.get('photos', [])
        if not photos_data:
            return create_response(400, {'error': 'No photos data provided'})
        
        # Check total payload size (limit to 50MB per photo, 100MB total)
        total_size = 0
        for photo_data in photos_data:
            image_data = photo_data.get('image', '')
            if image_data:
                # Estimate size from base64 (roughly 4/3 of base64 length)
                estimated_size = len(image_data) * 3 // 4
                total_size += estimated_size
                
                if estimated_size > 50 * 1024 * 1024:  # 50MB per photo
                    return create_response(413, {'error': f'Photo {photo_data.get("filename", "unknown")} is too large (max 50MB)'})
        
        if total_size > 100 * 1024 * 1024:  # 100MB total
            return create_response(413, {'error': 'Total upload size too large (max 100MB)'})
        
        # Get current photo count to set correct sort order
        from boto3.dynamodb.conditions import Key
        existing_photos = tbl_gallery_photos.query(
            KeyConditionExpression=Key('galleryId').eq(str(gallery_id))
        )
        current_photo_count = len(existing_photos.get('Items', []))
        
        uploaded_photos = []
        
        for photo_index, photo_data in enumerate(photos_data):
            filename = photo_data.get('filename')
            image_data = photo_data.get('image')  # Base64 encoded
            content_type = photo_data.get('contentType', 'image/jpeg')
                
            if not filename or not image_data:
                logger.warning(f"Skipping photo {filename}: missing filename or image data")
                continue
                
            file_extension = filename.split('.')[-1].lower()
            if file_extension not in ['jpg', 'jpeg', 'png', 'webp', 'avif']:
                continue
                
            # Generate unique filename
            unique_id = str(uuid.uuid4())
            s3_key = f'{gallery_path}/{unique_id}.{file_extension}'

            # Upload original image
            import base64
            image_bytes = base64.b64decode(image_data.split(',')[1] if ',' in image_data else image_data)
            s3_client.put_object(
                Bucket=BUCKET_NAME,
                Key=s3_key,
                Body=image_bytes,
                ContentType=content_type,
                Metadata={
                    'original-filename': filename,
                    'uploaded-at': datetime.utcnow().isoformat()
                }
            )
                
            # Generate thumbnail
            thumb_url = None
            try:
                base_image = Image.open(io.BytesIO(image_bytes))
                base_image.thumbnail((2000, 2000), Image.LANCZOS)
                if base_image.mode != "RGB":
                    base_image = base_image.convert("RGB")

                thumb_io = io.BytesIO()
                base_image.save(thumb_io, format="JPEG", quality=30, optimize=True)
                thumb_key = f"{gallery_path}/thumbnails/{unique_id}.jpg"
                s3_client.put_object(
                    Bucket=BUCKET_NAME,
                    Key=thumb_key,
                    Body=thumb_io.getvalue(),
                    ContentType='image/jpeg',
                    CacheControl='public, max-age=604800'
                )
                thumb_url = f'https://{BUCKET_NAME}.s3.eu-north-1.amazonaws.com/{thumb_key}'
            except Exception as e:
                logger.warning(f"Thumbnail generation failed for {filename}: {e}")

            # Generate photo metadata
            photo_metadata = {
                'galleryId': str(gallery_id),
                'photoId': unique_id,
                'name': filename.rsplit('.', 1)[0],
                's3Key': s3_key,
                'image': f'https://{BUCKET_NAME}.s3.eu-north-1.amazonaws.com/{s3_key}',
                'thumbnail': thumb_url or f'https://{BUCKET_NAME}.s3.eu-north-1.amazonaws.com/{s3_key}',
                'uploadedAt': datetime.utcnow().isoformat() + 'Z',   
                'format': file_extension.upper(),
                'lastModified': datetime.utcnow().isoformat() + 'Z',
                'sortOrder': current_photo_count + photo_index + 1  # Add sort order based on existing photos + upload order
            }
                
            # Image dimensions & file size
            try:
                image = Image.open(io.BytesIO(image_bytes))
                photo_metadata['width'] = image.width
                photo_metadata['height'] = image.height
                photo_metadata['fileSize'] = format_file_size(len(image_bytes))
            except Exception as e:
                logger.warning(f"Could not extract metadata for {filename}: {e}")
                
            # Store to DynamoDB
            tbl_gallery_photos.put_item(Item=photo_metadata)

            # Frontend response structure
            uploaded_photos.append({
                **photo_metadata,
                'id': photo_metadata['photoId']
            })
        
        if not uploaded_photos:
            return create_response(400, {'error': 'No photos were successfully uploaded'})
        
        # Update gallery information
        update_expr = "SET photoCount = :pc, updatedAt = :now"
        expr_vals = {
            ':pc': (gallery.get('photoCount') or 0) + len(uploaded_photos),
            ':now': datetime.utcnow().isoformat() + 'Z'
        }
        if not gallery.get('coverPhotoURL'):
            update_expr += ", coverPhotoURL = :cid"
            expr_vals[':cid'] = uploaded_photos[0]['thumbnail']

        tbl_galleries.update_item(
            Key={'galleryId': str(gallery_id)},
            UpdateExpression=update_expr,
            ExpressionAttributeValues=expr_vals
        )
        
        return create_response(200, {
            'message': f'Successfully uploaded {len(uploaded_photos)} photos',
            'uploaded_photos': uploaded_photos,
            'gallery_id': gallery_id
        })
        
    except Exception as e:
        logger.error(f"Error in upload_photos: {e}")
        return create_response(500, {'error': 'Failed to upload photos', 'details': str(e)})


def delete_photo(gallery_id: str, payload: dict):
    """
    Delete a photo from DynamoDB and S3.
    Accepts payload with photoId, photoNumber, or s3Key.
    """
    try:
        photo_id = payload.get('photoId') or payload.get('id')
        photo_number = payload.get('photoNumber')
        s3_key = payload.get('s3Key')

        # Find record from DynamoDB
        from boto3.dynamodb.conditions import Key
        item = None

        if photo_number:
            resp = tbl_gallery_photos.get_item(Key={'galleryId': str(gallery_id), 'photoId': str(photo_number)})
            item = resp.get('Item')
        elif photo_id or s3_key:
            q = tbl_gallery_photos.query(KeyConditionExpression=Key('galleryId').eq(str(gallery_id)))
            for it in q.get('Items', []):
                if it.get('photoId') == photo_id or it.get('s3Key') == s3_key:
                    item = it
                    break

        if not item:
            return create_response(404, {'error': 'Photo not found'})

        # Delete S3 original image
        if item.get('s3Key'):
            try:
                s3_client.delete_object(Bucket=BUCKET_NAME, Key=item['s3Key'])
            except ClientError:
                pass

        # Delete S3 thumbnail
        if item.get('thumbnail'):
            try:
                # Extract S3 key from thumbnail URL
                # Thumbnail URL format: https://bucket.s3.region.amazonaws.com/galleries/continent/country/gallery_name/thumbnails/filename.jpg
                thumbnail_url = item['thumbnail']
                if 'thumbnails/' in thumbnail_url and f'{BUCKET_NAME}.s3.eu-north-1.amazonaws.com/' in thumbnail_url:
                    # Extract S3 key part
                    thumbnail_key = thumbnail_url.split(f'{BUCKET_NAME}.s3.eu-north-1.amazonaws.com/')[1]
                    if thumbnail_key and not thumbnail_key.endswith('/'):
                        s3_client.delete_object(Bucket=BUCKET_NAME, Key=thumbnail_key)
                        logger.info(f"Deleted thumbnail: {thumbnail_key}")
                    else:
                        logger.warning(f"Invalid thumbnail key extracted: {thumbnail_key}")
                else:
                    logger.info(f"Thumbnail URL doesn't match expected pattern or is not a S3 thumbnail: {thumbnail_url}")
            except Exception as e:
                logger.warning(f"Failed to delete thumbnail: {e}")

        # Delete DynamoDB record
        tbl_gallery_photos.delete_item(
            Key={'galleryId': str(gallery_id), 'photoId': str(item.get('photoId') or item.get('photoNumber'))}
        )

        # Update gallery count
        now_ts = datetime.utcnow().isoformat() + 'Z'
        tbl_galleries.update_item(
            Key={'galleryId': str(gallery_id)},
            UpdateExpression="SET photoCount = if_not_exists(photoCount,:z) - :one, updatedAt = :now",
            ExpressionAttributeValues={':z': 0, ':one': 1, ':now': now_ts}
        )

        # If the deleted photo is the cover, remove coverPhotoURL
        g = tbl_galleries.get_item(Key={'galleryId': str(gallery_id)}).get('Item') or {}
        current_cover_photo_url = g.get('coverPhotoURL')
        if current_cover_photo_url:
            # Check if the deleted photo's thumbnail URL matches the cover photo URL
            deleted_photo_thumbnail = item.get('thumbnail')
            if deleted_photo_thumbnail and current_cover_photo_url == deleted_photo_thumbnail:
                tbl_galleries.update_item(
                    Key={'galleryId': str(gallery_id)},
                    UpdateExpression="REMOVE coverPhotoURL SET updatedAt = :now",
                    ExpressionAttributeValues={':now': now_ts}
                )

        return create_response(200, {'message': 'Photo deleted', 'deleted': True, 'photoId': item.get('photoId')})

    except Exception as e:
        logger.error(f"Error deleting photo: {e}")
        return create_response(500, {'error': str(e)})


def format_file_size(bytes_size):
    """
    Format file size in human readable format
    """
    for unit in ['B', 'KB', 'MB', 'GB']:
        if bytes_size < 1024.0:
            return f"{bytes_size:.2f} {unit}"
        bytes_size /= 1024.0
    return f"{bytes_size:.2f} TB"

def _convert_decimals(value):
    if isinstance(value, list):
        return [_convert_decimals(v) for v in value]
    if isinstance(value, dict):
        return {k: _convert_decimals(v) for k, v in value.items()}
    if isinstance(value, Decimal):
        try:
            # Cast to int if no fractional part
            return int(value) if value % 1 == 0 else float(value)
        except Exception:
            return float(value)
    return value


def create_response(status_code, body):
    """
    Create a standardized HTTP response
    """
    return {
        'statusCode': status_code,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',  # Configure this for your domain
            'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,Origin',
            'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
            'Access-Control-Max-Age': '86400'  # Cache preflight for 24 hours
        },
        'body': json.dumps(_convert_decimals(body), ensure_ascii=False)
    }

def update_galleries_metadata():
    """
    Scan S3 gallery folders directly and update DynamoDB Galleries table.
    This function scans S3 folder structure to find galleries and counts photos,
    then updates DynamoDB with only the information that can be derived from S3.
    Preserves existing DynamoDB data like coverPhotoURL, description, tags, etc.
    """
    try:
        logger.info("Starting update_galleries_metadata - scanning S3 folder structure directly")
        
        # Scan S3 for all gallery folders
        galleries_updated = 0
        galleries_created = 0
        errors = []
        total_folders_scanned = 0
        
        paginator = s3_client.get_paginator('list_objects_v2')
        
        # First, get all objects under galleries/ prefix
        all_objects = []
        for page in paginator.paginate(Bucket=BUCKET_NAME, Prefix='galleries/'):
            all_objects.extend(page.get('Contents', []))
        
        # Group objects by gallery path
        gallery_paths = {}
        for obj in all_objects:
            key = obj['Key']
            # Skip folder placeholders and metadata files
            if key.endswith('/') or key.endswith('.json'):
                continue
                
            # Extract gallery path: galleries/continent/country/gallery_name/
            path_parts = key.split('/')
            if len(path_parts) < 4:  # galleries/continent/country/name/file
                continue
                
            # Reconstruct gallery path
            gallery_path = '/'.join(path_parts[:4]) + '/'  # galleries/continent/country/name/
            if gallery_path not in gallery_paths:
                gallery_paths[gallery_path] = {
                    'continent': path_parts[1],
                    'country': path_parts[2],
                    'name': path_parts[3],
                    'photo_count': 0,
                    'files': [],
                    'photos': []  # Store actual photo files (not thumbnails)
                }
            
            # Count photos and store photo files (exclude thumbnails folder)
            if '/thumbnails/' not in key:
                gallery_paths[gallery_path]['photo_count'] += 1
                # Store photo files for cover photo selection
                if key.lower().endswith(('.jpg', '.jpeg', '.png', '.webp', '.avif', '.tiff', '.bmp')):
                    gallery_paths[gallery_path]['photos'].append(key)
            gallery_paths[gallery_path]['files'].append(key)
        
        total_folders_scanned = len(gallery_paths)
        logger.info(f"Found {total_folders_scanned} gallery folders in S3")
        
        # Process each gallery
        for gallery_path, gallery_info in gallery_paths.items():
            try:
                logger.info(f"Processing gallery: {gallery_path}")
                logger.info(f"Gallery info: {json.dumps(gallery_info, default=str)}")
                
                # Generate a unique ID for this gallery based on path
                # Use a hash of the path to ensure consistency
                import hashlib
                path_hash = hashlib.md5(gallery_path.encode()).hexdigest()
                gallery_id = f"gallery-{path_hash[:8]}"
                
                # Check if gallery already exists in DynamoDB
                existing_response = tbl_galleries.get_item(Key={'galleryId': gallery_id})
                existing_gallery = existing_response.get('Item')
                
                now = datetime.utcnow().isoformat() + 'Z'
                
                # Determine cover photo thumbnail URL from first available photo
                cover_photo_url = None
                if gallery_info['photos']:
                    # Get the first photo file and construct thumbnail URL
                    first_photo_key = sorted(gallery_info['photos'])[0]  # Sort for consistency
                    # Extract filename without extension
                    filename = first_photo_key.split('/')[-1]
                    photo_id = filename.rsplit('.', 1)[0]  # Remove extension
                    
                    # Get the original file extension
                    original_extension = filename.rsplit('.', 1)[1].lower() if '.' in filename else 'jpg'
                    
                    # Construct the full thumbnail URL - use the same extension as original
                    base_url = f"https://{BUCKET_NAME}.s3.eu-north-1.amazonaws.com"
                    gallery_path = f"galleries/{gallery_info['continent']}/{gallery_info['country']}/{gallery_info['name']}"
                    cover_photo_url = f"{base_url}/{gallery_path}/thumbnails/{photo_id}.{original_extension}"
                    
                    logger.info(f"Selected cover photo for {gallery_info['name']}: {photo_id}")
                    logger.info(f"Cover photo thumbnail URL: {cover_photo_url}")
                
                if existing_gallery:
                    # Update existing gallery - only update fields we can derive from S3
                    logger.info(f"Updating existing gallery: {gallery_info['name']} (ID: {gallery_id})")
                    
                    update_expr = "SET #n=:n, continent=:c, country=:co, photoCount=:pc, updatedAt=:now"
                    expr_vals = {
                        ':n': gallery_info['name'],
                        ':c': gallery_info['continent'],
                        ':co': gallery_info['country'],
                        ':pc': gallery_info['photo_count'],
                        ':now': now
                    }
                    expr_names = {'#n': 'name'}
                    
                    # Add cover photo update if we have photos and no existing cover
                    if cover_photo_url and not existing_gallery.get('coverPhotoURL'):
                        update_expr += ", coverPhotoURL = :cpid"
                        expr_vals[':cpid'] = cover_photo_url
                        logger.info(f"Setting cover photo URL for {gallery_info['name']}: {cover_photo_url}")
                    
                    # Only update if values have actually changed
                    if (existing_gallery.get('name') != gallery_info['name'] or
                        existing_gallery.get('continent') != gallery_info['continent'] or
                        existing_gallery.get('country') != gallery_info['country'] or
                        existing_gallery.get('photoCount') != gallery_info['photo_count'] or
                        (cover_photo_url and not existing_gallery.get('coverPhotoURL'))):
                        
                        tbl_galleries.update_item(
                            Key={'galleryId': gallery_id},
                            UpdateExpression=update_expr,
                            ExpressionAttributeValues=expr_vals,
                            ExpressionAttributeNames=expr_names
                        )
                        galleries_updated += 1
                        logger.info(f"Updated gallery: {gallery_info['name']}")
                    else:
                        logger.info(f"No changes needed for gallery: {gallery_info['name']}")
                else:
                    # Create new gallery with minimal required fields
                    logger.info(f"Creating new gallery: {gallery_info['name']} (ID: {gallery_id})")
                    
                    latlon = geocode_place(gallery_info['name'], gallery_info.get('country'))
                    logger.info(f"Geocoded coordinates for {gallery_info['name']}: {latlon}")  
                    gallery_data = {
                        'galleryId': gallery_id,
                        'name': gallery_info['name'],
                        'continent': gallery_info['continent'],
                        'country': gallery_info['country'],
                        'photoCount': gallery_info['photo_count'],
                        'latitude': latlon[0],
                        'longitude': latlon[1],
                        'createdAt': now,
                        'updatedAt': now
                    }
                    
                    # Add cover photo if available
                    if cover_photo_url:
                        gallery_data['coverPhotoURL'] = cover_photo_url
                        logger.info(f"Created gallery with cover photo URL: {gallery_info['name']} -> {cover_photo_url}")
                    
                    tbl_galleries.put_item(Item=gallery_data)
                    galleries_created += 1
                    logger.info(f"Created gallery: {gallery_info['name']}")
                        
            except Exception as e:
                error_msg = f"Error processing gallery {gallery_path}: {str(e)}"
                logger.error(error_msg)
                errors.append(error_msg)
                continue
        
        total_processed = galleries_updated + galleries_created
        
        logger.info(f"=== UPDATE GALLERIES METADATA SUMMARY ===")
        logger.info(f"Total gallery folders found in S3: {total_folders_scanned}")
        logger.info(f"Galleries updated: {galleries_updated}")
        logger.info(f"Galleries created: {galleries_created}")
        logger.info(f"Total processed: {total_processed}")
        logger.info(f"Errors: {len(errors)}")
        logger.info(f"==========================================")
        
        return create_response(200, {
            'message': 'Galleries metadata updated successfully from S3 folder structure',
            'galleries_updated': galleries_updated,
            'galleries_created': galleries_created,
            'total_processed': total_processed,
            'total_folders_scanned': total_folders_scanned,
            'errors': errors if errors else []
        })
        
    except Exception as e:
        logger.error(f"Error in update_galleries_metadata: {str(e)}")
        return create_response(500, {'error': 'Failed to update galleries metadata', 'details': str(e)})


def update_GalleryPhotos(request_body=None):
    """
    Update DynamoDB GalleryPhotos table with uploaded photo information.
    This function can either scan S3 for all photos (when called without body)
    or update specific photos from the request body (new upload flow).
    """
    try:
        # Check if this is a new upload flow (with request body) or S3 scan flow
        if request_body and 'galleryId' in request_body and 'photos' in request_body:
            logger.info("Starting update_GalleryPhotos - processing new uploads")
            return process_new_uploads(request_body)
        else:
            logger.info("Starting update_GalleryPhotos - scanning S3 for all photos")
            return scan_s3_for_photos()
        
    except Exception as e:
        logger.error(f"Error in update_GalleryPhotos: {str(e)}")
        return create_response(500, {
            'error': f'Failed to update gallery photos: {str(e)}'
        })


def process_new_uploads(request_data):
    """
    Process new photo uploads and add them to DynamoDB GalleryPhotos table
    """
    try:
        logger.info(f"Processing new uploads with data: {request_data}")
        
        gallery_id = request_data['galleryId']
        photos_data = request_data['photos']
        
        if not isinstance(photos_data, list) or len(photos_data) == 0:
            return create_response(400, {'error': 'Photos must be a non-empty array'})
        
        # Validate each photo entry
        for photo in photos_data:
            required_fields = ['filename', 'thumbnailFilename', 's3Key', 'thumbnailKey', 'contentType']
            for field in required_fields:
                if field not in photo:
                    return create_response(400, {'error': f'Each photo must have {field}'})
        
        # Process each photo
        photos_created = 0
        errors = []
        
        for photo in photos_data:
            try:
                # Generate unique photo ID
                photo_id = str(uuid.uuid4())
                
                # Build URLs
                base_url = f"https://{BUCKET_NAME}.s3.eu-north-1.amazonaws.com"
                image_url = f"{base_url}/{photo['s3Key']}"
                thumbnail_url = f"{base_url}/{photo['thumbnailKey']}"
                
                # Prepare photo data for DynamoDB
                now = datetime.utcnow().isoformat() + 'Z'
                photo_data = {
                    'galleryId': gallery_id,
                    'photoId': photo_id,
                    'name': photo['filename'].rsplit('.', 1)[0],  # filename without extension
                    's3Key': photo['s3Key'],
                    'thumbnailKey': photo['thumbnailKey'],
                    'image': image_url,
                    'thumbnail': thumbnail_url,
                    'uploadedAt': now,
                    'format': photo['contentType'].split('/')[-1].upper(),
                    'lastModified': now,
                    'fileSize': format_file_size(photo.get('fileSize', 0)),
                    'thumbnailSize': format_file_size(photo.get('thumbnailSize', 0))
                }
                
                # Add dimensions if available
                if 'width' in photo and 'height' in photo:
                    photo_data['dimensions'] = f"{photo['width']}x{photo['height']}"
                
                # Create new photo in DynamoDB
                logger.info(f"Creating new photo: {photo['filename']}")
                tbl_gallery_photos.put_item(Item=photo_data)
                photos_created += 1
                
                # Add the created photo to the response
                photo_data['id'] = photo_id
                photo_data['title'] = photo_data['name']
                
            except Exception as e:
                error_msg = f"Error processing photo {photo['filename']}: {str(e)}"
                logger.error(error_msg)
                errors.append(error_msg)
                continue
        
        if errors:
            if photos_created == 0:
                return create_response(500, {
                    'error': 'All photo uploads failed',
                    'details': errors
                })
            else:
                return create_response(200, {
                    'success': True,
                    'message': f'Partially processed photo uploads: {photos_created} successful, {len(errors)} failed',
                    'photos_created': photos_created,
                    'errors': errors,
                    'partial_success': True
                })
        else:
            return create_response(200, {
                'success': True,
                'message': f'Successfully processed {photos_created} photo uploads',
                'photos_created': photos_created
            })
            
    except Exception as e:
        logger.error(f"Error in process_new_uploads: {str(e)}")
        return create_response(500, {
            'error': f'Failed to process new uploads: {str(e)}'
        })


def scan_s3_for_photos():
    """
    Scan S3 for all photos and update DynamoDB GalleryPhotos table.
    This function scans S3 folder structure to find all photos, extracts metadata,
    and upserts them to DynamoDB GalleryPhotos table.
    """
    try:
        # Scan S3 for all photos
        photos_updated = 0
        photos_created = 0
        errors = []
        total_files_scanned = 0
        
        paginator = s3_client.get_paginator('list_objects_v2')
        
        # First, get all objects under galleries/ prefix
        all_objects = []
        for page in paginator.paginate(Bucket=BUCKET_NAME, Prefix='galleries/'):
            all_objects.extend(page.get('Contents', []))
        
        # Group photos by gallery and extract metadata
        gallery_photos = {}
        
        for obj in all_objects:
            key = obj['Key']
            total_files_scanned += 1
            
            # Skip folder placeholders, metadata files, and thumbnails
            if (key.endswith('/') or 
                key.endswith('.json') or 
                '/thumbnails/' in key):
                continue
            
            # Check if it's an image file
            if not key.lower().endswith(('.jpg', '.jpeg', '.png', '.webp', '.avif', '.tiff', '.bmp')):
                continue
            
            # Extract gallery path: galleries/continent/country/gallery_name/
            path_parts = key.split('/')
            if len(path_parts) < 5:  # galleries/continent/country/name/file
                continue
            
            # Reconstruct gallery path and photo info
            gallery_path = '/'.join(path_parts[:4]) + '/'  # galleries/continent/country/name/
            filename = path_parts[-1]
            file_extension = filename.split('.')[-1].lower()
            
            if gallery_path not in gallery_photos:
                gallery_photos[gallery_path] = {
                    'continent': path_parts[1],
                    'country': path_parts[2],
                    'name': path_parts[3],
                    'photos': []
                }
            
            # Extract photo metadata
            photo_info = {
                'filename': filename,
                's3Key': key,
                'file_extension': file_extension,
                'file_size': obj.get('Size', 0),
                'last_modified': obj.get('LastModified'),
                'path_parts': path_parts
            }
            
            gallery_photos[gallery_path]['photos'].append(photo_info)
        
        logger.info(f"Found {len(gallery_photos)} galleries with photos")
        
        # Process each gallery's photos
        for gallery_path, gallery_info in gallery_photos.items():
            try:
                logger.info(f"Processing photos for gallery: {gallery_path}")
                logger.info(f"Found {len(gallery_info['photos'])} photos")
                
                # Generate gallery ID (same logic as update_galleries_metadata)
                import hashlib
                path_hash = hashlib.md5(gallery_path.encode()).hexdigest()
                gallery_id = f"gallery-{path_hash[:8]}"
                
                # Check if gallery exists in DynamoDB
                gallery_response = tbl_galleries.get_item(Key={'galleryId': gallery_id})
                if 'Item' not in gallery_response:
                    logger.warning(f"Gallery {gallery_id} not found in DynamoDB, skipping photos")
                    continue
                
                # Process each photo
                for photo_info in gallery_info['photos']:
                    try:
                        # Generate unique photo ID
                        photo_id = str(uuid.uuid4())
                        
                        # Build URLs
                        base_url = f"https://{BUCKET_NAME}.s3.eu-north-1.amazonaws.com"
                        image_url = f"{base_url}/{photo_info['s3Key']}"
                        
                        # Check for thumbnail - look in thumbnails folder
                        # Original path: galleries/continent/country/gallery_name/filename.ext
                        # Thumbnail path: galleries/continent/country/gallery_name/thumbnails/filename.ext
                        path_parts = photo_info['s3Key'].split('/')
                        if len(path_parts) >= 4:
                            # Insert 'thumbnails' before the filename
                            thumbnail_parts = path_parts[:-1] + ['thumbnails'] + [path_parts[-1]]
                            thumbnail_key = '/'.join(thumbnail_parts)
                        else:
                            thumbnail_key = photo_info['s3Key']
                        
                        thumbnail_url = None
                        try:
                            s3_client.head_object(Bucket=BUCKET_NAME, Key=thumbnail_key)
                            thumbnail_url = f"{base_url}/{thumbnail_key}"
                            logger.info(f"Found thumbnail: {thumbnail_key}")
                        except:
                            # No thumbnail found, use image as thumbnail
                            thumbnail_url = image_url
                            logger.info(f"No thumbnail found for {photo_info['filename']}, using original image")
                        
                        # Prepare photo data for DynamoDB
                        now = datetime.utcnow().isoformat() + 'Z'
                        photo_data = {
                            'galleryId': gallery_id,
                            'photoId': photo_id,
                            'name': photo_info['filename'].rsplit('.', 1)[0],  # filename without extension
                            's3Key': photo_info['s3Key'],
                            'image': image_url,
                            'thumbnail': thumbnail_url,
                            'uploadedAt': now,
                            'format': photo_info['file_extension'].upper(),
                            'lastModified': now,
                            'fileSize': format_file_size(photo_info['file_size'])
                        }
                        
                        # Try to extract image dimensions and metadata
                        try:
                            # Get image from S3
                            response = s3_client.get_object(Bucket=BUCKET_NAME, Key=photo_info['s3Key'])
                            image_content = response['Body'].read()
                            
                            # Open image with PIL
                            image = Image.open(io.BytesIO(image_content))
                            
                            # Get dimensions and add dimensions field
                            photo_data['dimensions'] = f"{image.width}x{image.height}"
                            
                            # Extract EXIF data
                            exif_data = {}
                            if hasattr(image, 'getexif'):
                                exif = image.getexif()
                                if exif:
                                    for tag_id, value in exif.items():
                                        tag = TAGS.get(tag_id, tag_id)
                                        try:
                                            if isinstance(value, bytes):
                                                value = value.decode('utf-8', errors='ignore')
                                            exif_data[tag] = value
                                        except:
                                            continue
                            
                            if exif_data:
                                photo_data['hasExif'] = True
                                
                                # Try to get date taken
                                date_taken = exif_data.get('DateTime') or exif_data.get('DateTimeOriginal')
                                if date_taken:
                                    try:
                                        taken_at = datetime.strptime(str(date_taken), '%Y:%m:%d %H:%M:%S').isoformat() + 'Z'
                                        photo_data['takenAt'] = taken_at
                                    except:
                                        pass
                            
                        except Exception as e:
                            logger.warning(f"Could not extract metadata for {photo_info['filename']}: {e}")
                            photo_data['hasExif'] = False
                        
                        # Check if photo already exists in DynamoDB
                        # Use s3Key to find existing photo
                        from boto3.dynamodb.conditions import Key
                        existing_photos = tbl_gallery_photos.query(
                            KeyConditionExpression=Key('galleryId').eq(gallery_id)
                        )
                        
                        existing_photo = None
                        for existing in existing_photos.get('Items', []):
                            if existing.get('s3Key') == photo_info['s3Key']:
                                existing_photo = existing
                                break
                        
                        if existing_photo:
                            # Update existing photo
                            logger.info(f"Updating existing photo: {photo_info['filename']}")
                            
                            update_expr = "SET #n=:n, s3Key=:sk, image=:img, thumbnail=:th, format=:fmt, lastModified=:now, fileSize=:fs"
                            expr_vals = {
                                ':n': photo_data['name'],
                                ':sk': photo_data['s3Key'],
                                ':img': photo_data['image'],
                                ':th': photo_data['thumbnail'],
                                ':fmt': photo_data['format'],
                                ':now': photo_data['lastModified'],
                                ':fs': photo_data['fileSize']
                            }
                            expr_names = {'#n': 'name'}
                            
                            # Add optional fields if they exist
                            if 'dimensions' in photo_data:
                                update_expr += ", dimensions=:dim"
                                expr_vals[':dim'] = photo_data['dimensions']
                            
                            if 'hasExif' in photo_data:
                                update_expr += ", hasExif=:exif"
                                expr_vals[':exif'] = photo_data['hasExif']
                            
                            if 'takenAt' in photo_data:
                                update_expr += ", takenAt=:ta"
                                expr_vals[':ta'] = photo_data['takenAt']
                            
                            tbl_gallery_photos.update_item(
                                Key={'galleryId': gallery_id, 'photoId': existing_photo['photoId']},
                                UpdateExpression=update_expr,
                                ExpressionAttributeValues=expr_vals,
                                ExpressionAttributeNames=expr_names
                            )
                            photos_updated += 1
                        else:
                            # Create new photo
                            logger.info(f"Creating new photo: {photo_info['filename']}")
                            tbl_gallery_photos.put_item(Item=photo_data)
                            photos_created += 1
                            
                    except Exception as e:
                        error_msg = f"Error processing photo {photo_info['filename']}: {str(e)}"
                        logger.error(error_msg)
                        errors.append(error_msg)
                        continue
                        
            except Exception as e:
                error_msg = f"Error processing gallery {gallery_path}: {str(e)}"
                logger.error(error_msg)
                errors.append(error_msg)
                continue
        
        total_processed = photos_updated + photos_created
        
        logger.info(f"=== UPDATE GALLERY PHOTOS SUMMARY ===")
        logger.info(f"Total files scanned in S3: {total_files_scanned}")
        logger.info(f"Galleries with photos found: {len(gallery_photos)}")
        logger.info(f"Photos updated: {photos_updated}")
        logger.info(f"Photos created: {photos_created}")
        logger.info(f"Total processed: {total_processed}")
        logger.info(f"Errors: {len(errors)}")
        logger.info(f"=====================================")
        
        return create_response(200, {
            'message': 'Gallery photos metadata updated successfully from S3',
            'photos_updated': photos_updated,
            'photos_created': photos_created,
            'total_processed': total_processed,
            'total_files_scanned': total_files_scanned,
            'galleries_found': len(gallery_photos),
            'errors': errors if errors else []
        })
        
    except Exception as e:
        logger.error(f"Error in update_GalleryPhotos: {str(e)}")
        return create_response(500, {'error': 'Failed to update gallery photos metadata', 'details': str(e)})


def rate_photo(body):
    """
    Rate a photo with 0-5 stars
    """
    try:
        # Validate required fields
        required_fields = ['photoId', 'deviceId', 'rating']
        for field in required_fields:
            if field not in body:
                return create_response(400, {'error': f'Missing required field: {field}'})
        
        photo_id = body['photoId']
        device_id = body['deviceId']
        rating = int(body['rating'])
        
        # Validate rating range
        if rating < 0 or rating > 5:
            return create_response(400, {'error': 'Rating must be between 0 and 5'})
        
        # Check if photo exists
        try:
            # Query GalleryPhotos table to find the photo
            from boto3.dynamodb.conditions import Key
            response = tbl_gallery_photos.scan(
                FilterExpression=Key('photoId').eq(photo_id)
            )
            
            if not response.get('Items'):
                return create_response(404, {'error': 'Photo not found'})
        except Exception as e:
            logger.error(f"Error checking photo existence: {e}")
            return create_response(500, {'error': 'Failed to verify photo existence'})
        
        current_time = datetime.utcnow().isoformat() + 'Z'
        
        # Check if user already rated this photo
        try:
            existing_rating = tbl_photo_ratings.get_item(
                Key={'photoId': photo_id, 'deviceId': device_id}
            )
            
            if rating == 0:
                # Rating is 0, delete the rating record if it exists
                if existing_rating.get('Item'):
                    tbl_photo_ratings.delete_item(
                        Key={'photoId': photo_id, 'deviceId': device_id}
                    )
                    action = 'deleted'
                else:
                    # No existing rating to delete
                    action = 'no_action'
            elif existing_rating.get('Item'):
                # Update existing rating
                tbl_photo_ratings.update_item(
                    Key={'photoId': photo_id, 'deviceId': device_id},
                    UpdateExpression='SET rating = :r, updatedAt = :u',
                    ExpressionAttributeValues={
                        ':r': rating,
                        ':u': current_time
                    }
                )
                action = 'updated'
            else:
                # Create new rating
                rating_item = {
                    'photoId': photo_id,
                    'deviceId': device_id,
                    'rating': rating,
                    'createdAt': current_time,
                    'updatedAt': current_time
                }
                tbl_photo_ratings.put_item(Item=rating_item)
                action = 'created'
                
        except Exception as e:
            logger.error(f"Error saving rating: {e}")
            return create_response(500, {'error': 'Failed to save rating'})
        
        # Prepare response message based on action
        if action == 'deleted':
            message = 'Rating deleted successfully'
        elif action == 'no_action':
            message = 'No rating to delete'
        else:
            message = f'Rating {action} successfully'
        
        return create_response(200, {
            'message': message,
            'photoId': photo_id,
            'deviceId': device_id,
            'rating': rating,
            'action': action
        })
        
    except ValueError:
        return create_response(400, {'error': 'Invalid rating value'})
    except Exception as e:
        logger.error(f"Error in rate_photo: {str(e)}")
        return create_response(500, {'error': 'Failed to rate photo', 'details': str(e)})


def get_photo_rating(query_params):
    """
    Get photo rating statistics and user's rating if deviceId provided
    """
    try:
        photo_id = query_params.get('photoId')
        device_id = query_params.get('deviceId')
        
        if not photo_id:
            return create_response(400, {'error': 'Photo ID is required'})
        
        # Get all ratings for this photo
        try:
            from boto3.dynamodb.conditions import Key
            response = tbl_photo_ratings.query(
                KeyConditionExpression=Key('photoId').eq(photo_id)
            )
            ratings = response.get('Items', [])
        except Exception as e:
            logger.error(f"Error querying ratings: {e}")
            return create_response(500, {'error': 'Failed to query ratings'})
        
        # Calculate statistics
        total_ratings = len(ratings)
        if total_ratings == 0:
            return create_response(200, {
                'photoId': photo_id,
                'totalRatings': 0,
                'averageRating': 0,
                'ratingDistribution': {str(i): 0 for i in range(6)},
                'userRating': None
            })
        
        # Calculate average and distribution
        total_score = sum(r['rating'] for r in ratings)
        average_rating = round(total_score / total_ratings, 2)
        
        rating_distribution = {str(i): 0 for i in range(6)}
        for rating in ratings:
            rating_distribution[str(rating['rating'])] += 1
        
        # Get user's rating if deviceId provided
        user_rating = None
        if device_id:
            user_rating_item = next(
                (r for r in ratings if r['deviceId'] == device_id), 
                None
            )
            if user_rating_item:
                user_rating = user_rating_item['rating']
        
        return create_response(200, {
            'photoId': photo_id,
            'totalRatings': total_ratings,
            'averageRating': average_rating,
            'ratingDistribution': rating_distribution,
            'userRating': user_rating
        })
        
    except Exception as e:
        logger.error(f"Error in get_photo_rating: {str(e)}")
        return create_response(500, {'error': 'Failed to get photo rating', 'details': str(e)})

def geocode_place(gallery_name, country=None):
    global _last_geocode_ts
    name = (gallery_name or "").strip()
    ctry = (country or "").strip()
    if not name:
        return None

    cache_key = (name.lower(), ctry.lower())
    if cache_key in _geocode_cache:
        return _geocode_cache[cache_key]

    q = f"{name}, {ctry}" if ctry else name

    elapsed = time.time() - _last_geocode_ts
    if elapsed < 1:
        time.sleep(1 - elapsed)

    url = "https://nominatim.openstreetmap.org/search?" + urllib.parse.urlencode({
        "q": q, "format": "json", "limit": 1
    })
    req = urllib.request.Request(url, headers={
        "User-Agent": "my-photo-app/1.0 (contact@example.com)"
    })

    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            _last_geocode_ts = time.time()
            data = json.loads(resp.read().decode("utf-8"))
            if data:
                lat = Decimal(data[0]["lat"])
                lon = Decimal(data[0]["lon"])
                _geocode_cache[cache_key] = (lat, lon)
                return lat, lon
    except Exception as e:
        print(f"Geocode failed for '{q}': {e}")

    _geocode_cache[cache_key] = None
    return None

def update_gallery_sort_order(request_data):
    """
    Update the sort order (sequence) for multiple galleries
    """
    try:
        logger.info(f"Updating gallery sort order with data: {request_data}")
        
        # Validate request data
        if 'galleries' not in request_data:
            return create_response(400, {'error': 'Missing galleries array in request'})
        
        galleries_data = request_data['galleries']
        if not isinstance(galleries_data, list) or len(galleries_data) == 0:
            return create_response(400, {'error': 'Galleries must be a non-empty array'})
        
        # Validate each gallery entry
        for gallery in galleries_data:
            if 'galleryId' not in gallery:
                return create_response(400, {'error': 'Each gallery must have galleryId'})
            if 'sortOrder' not in gallery:
                return create_response(400, {'error': 'Each gallery must have sortOrder'})
            if not isinstance(gallery['sortOrder'], (int, float)) or gallery['sortOrder'] < 1:
                return create_response(400, {'error': 'sortOrder must be a positive number'})
        
        # Update each gallery's sort order in DynamoDB
        updated_count = 0
        errors = []
        
        for gallery in galleries_data:
            try:
                gallery_id = gallery['galleryId']
                sort_order = int(gallery['sortOrder'])
                
                # Update the gallery with new sort order
                response = tbl_galleries.update_item(
                    Key={'galleryId': gallery_id},
                    UpdateExpression='SET sortOrder = :sort_order, updatedAt = :updated_at',
                    ExpressionAttributeValues={
                        ':sort_order': sort_order,
                        ':updated_at': datetime.utcnow().isoformat() + 'Z'
                    },
                    ConditionExpression='attribute_exists(galleryId)',
                    ReturnValues='UPDATED_NEW'
                )
                
                logger.info(f"Successfully updated sort order for gallery {gallery_id} to {sort_order}")
                updated_count += 1
                
            except ClientError as e:
                if e.response['Error']['Code'] == 'ConditionalCheckFailedException':
                    error_msg = f"Gallery {gallery['galleryId']} not found"
                    logger.warning(error_msg)
                    errors.append(error_msg)
                else:
                    error_msg = f"Error updating gallery {gallery['galleryId']}: {str(e)}"
                    logger.error(error_msg)
                    errors.append(error_msg)
            except Exception as e:
                error_msg = f"Unexpected error updating gallery {gallery['galleryId']}: {str(e)}"
                logger.error(error_msg)
                errors.append(error_msg)
        
        # Prepare response
        if errors:
            if updated_count == 0:
                # All updates failed
                return create_response(500, {
                    'success': False,
                    'error': 'All gallery sort order updates failed',
                    'details': errors
                })
            else:
                # Some updates succeeded, some failed
                return create_response(200, {
                    'success': True,
                    'message': f'Partially updated gallery sort orders: {updated_count} successful, {len(errors)} failed',
                    'updated_count': updated_count,
                    'errors': errors,
                    'partial_success': True
                })
        else:
            # All updates succeeded
            return create_response(200, {
                'success': True,
                'message': f'Successfully updated sort order for {updated_count} galleries',
                'updated_count': updated_count
            })
            
    except Exception as e:
        logger.error(f"Error in update_gallery_sort_order: {str(e)}")
        return create_response(500, {
            'success': False,
            'error': 'Failed to update gallery sort order',
            'details': str(e)
        })

def update_photo_sort_order(request_data):
    """
    Update the sort order (sequence) for photos within a gallery
    """
    try:
        logger.info(f"Updating photo sort order with data: {request_data}")
        
        # Validate request data
        if 'galleryId' not in request_data:
            return create_response(400, {'error': 'Missing galleryId in request'})
        if 'photos' not in request_data:
            return create_response(400, {'error': 'Missing photos array in request'})
        
        gallery_id = request_data['galleryId']
        photos_data = request_data['photos']
        
        if not isinstance(photos_data, list) or len(photos_data) == 0:
            return create_response(400, {'error': 'Photos must be a non-empty array'})
        
        # Validate each photo entry
        for photo in photos_data:
            if 'photoId' not in photo:
                return create_response(400, {'error': 'Each photo must have photoId'})
            if 'sortOrder' not in photo:
                return create_response(400, {'error': 'Each photo must have sortOrder'})
            if not isinstance(photo['sortOrder'], (int, float)) or photo['sortOrder'] < 1:
                return create_response(400, {'error': 'sortOrder must be a positive number'})
        
        # Update each photo's sort order in DynamoDB
        updated_count = 0
        errors = []
        
        for photo in photos_data:
            try:
                photo_id = photo['photoId']
                sort_order = int(photo['sortOrder'])
                
                # Update the photo with new sort order
                response = tbl_gallery_photos.update_item(
                    Key={'galleryId': gallery_id, 'photoId': photo_id},
                    UpdateExpression='SET sortOrder = :sort_order, updatedAt = :updated_at',
                    ExpressionAttributeValues={
                        ':sort_order': sort_order,
                        ':updated_at': datetime.utcnow().isoformat() + 'Z'
                    },
                    ConditionExpression='attribute_exists(galleryId) AND attribute_exists(photoId)',
                    ReturnValues='UPDATED_NEW'
                )
                
                logger.info(f"Successfully updated sort order for photo {photo_id} to {sort_order}")
                updated_count += 1
                
            except ClientError as e:
                if e.response['Error']['Code'] == 'ConditionalCheckFailedException':
                    error_msg = f"Photo {photo['photoId']} not found in gallery {gallery_id}"
                    logger.warning(error_msg)
                    errors.append(error_msg)
                else:
                    error_msg = f"Error updating photo {photo['photoId']}: {str(e)}"
                    logger.error(error_msg)
                    errors.append(error_msg)
            except Exception as e:
                error_msg = f"Unexpected error updating photo {photo['photoId']}: {str(e)}"
                logger.error(error_msg)
                errors.append(error_msg)
        
        # Prepare response
        if errors:
            if updated_count == 0:
                # All updates failed
                return create_response(500, {
                    'success': False,
                    'error': 'All photo sort order updates failed',
                    'details': errors
                })
            else:
                # Some updates succeeded, some failed
                return create_response(200, {
                    'success': True,
                    'message': f'Partially updated photo sort orders: {updated_count} successful, {len(errors)} failed',
                    'updated_count': updated_count,
                    'errors': errors,
                    'partial_success': True
                })
        else:
            # All updates succeeded
            return create_response(200, {
                'success': True,
                'message': f'Successfully updated sort order for {updated_count} photos',
                'updated_count': updated_count
            })
            
    except Exception as e:
        logger.error(f"Error in update_photo_sort_order: {str(e)}")
        return create_response(500, {
            'success': False,
            'error': 'Failed to update photo sort order',
            'details': str(e)
        })


def get_upload_urls(gallery_id, request_data):
    """
    Generate presigned URLs for S3 uploads to bypass API Gateway size limits
    """
    try:
        logger.info(f"Generating upload URLs for gallery {gallery_id}")
        
        # Get gallery information to build correct S3 path
        try:
            gallery_response = tbl_galleries.get_item(Key={'galleryId': gallery_id})
            if 'Item' not in gallery_response:
                return create_response(400, {'error': f'Gallery {gallery_id} not found'})
            
            gallery = gallery_response['Item']
            continent = gallery.get('continent', 'unknown')
            country = gallery.get('country', 'unknown')
            name = gallery.get('name', 'unknown')
            
            # Build the correct gallery path: galleries/continent/country/name/
            gallery_path = f"galleries/{continent}/{country}/{name}"
            logger.info(f"Gallery path: {gallery_path}")
            
        except Exception as e:
            logger.error(f"Error getting gallery info: {str(e)}")
            return create_response(500, {'error': f'Failed to get gallery information: {str(e)}'})
        
        # Validate request data
        if 'photos' not in request_data:
            return create_response(400, {'error': 'Missing photos array in request'})
        
        photos_data = request_data['photos']
        if not isinstance(photos_data, list) or len(photos_data) == 0:
            return create_response(400, {'error': 'Photos must be a non-empty array'})
        
        # Validate each photo entry
        for photo in photos_data:
            if 'filename' not in photo:
                return create_response(400, {'error': 'Each photo must have filename'})
            if 'thumbnailFilename' not in photo:
                return create_response(400, {'error': 'Each photo must have thumbnailFilename'})
        
        # Generate presigned URLs for each photo
        upload_urls = []
        
        for photo in photos_data:
            try:
                # Generate unique photo ID
                photo_id = str(uuid.uuid4())
                
                # Create S3 keys using the correct gallery path
                # Original: galleries/continent/country/gallery_name/filename.webp
                # Thumbnail: galleries/continent/country/gallery_name/thumbnails/filename_thumb.webp
                original_key = f"{gallery_path}/{photo['filename']}"
                thumbnail_key = f"{gallery_path}/thumbnails/{photo['thumbnailFilename']}"
                
                # Generate presigned URLs for PUT operations
                original_url = s3_client.generate_presigned_url(
                    'put_object',
                    Params={
                        'Bucket': BUCKET_NAME,
                        'Key': original_key,
                        'ContentType': photo.get('contentType', 'image/webp')
                    },
                    ExpiresIn=3600  # 1 hour expiration
                )
                
                thumbnail_url = s3_client.generate_presigned_url(
                    'put_object',
                    Params={
                        'Bucket': BUCKET_NAME,
                        'Key': thumbnail_key,
                        'ContentType': photo.get('contentType', 'image/webp')
                    },
                    ExpiresIn=3600  # 1 hour expiration
                )
                
                upload_urls.append({
                    'photo_id': photo_id,
                    'original_url': original_url,
                    'thumbnail_url': thumbnail_url,
                    'original_key': original_key,
                    'thumbnail_key': thumbnail_key
                })
                
                logger.info(f"Generated presigned URLs for photo {photo_id}")
                
            except Exception as e:
                logger.error(f"Error generating presigned URLs for photo {photo.get('filename', 'unknown')}: {str(e)}")
                return create_response(500, {
                    'error': f'Failed to generate presigned URLs: {str(e)}'
                })
        
        logger.info(f"Successfully generated {len(upload_urls)} presigned URLs")
        
        return create_response(200, {
            'success': True,
            'upload_urls': upload_urls,
            'message': f'Generated {len(upload_urls)} presigned URLs'
        })
        
    except Exception as e:
        logger.error(f"Error in get_upload_urls: {str(e)}")
        return create_response(500, {
            'error': f'Failed to generate upload URLs: {str(e)}'
        })


