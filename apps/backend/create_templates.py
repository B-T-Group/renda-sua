#!/usr/bin/env python3

import os
import json
import requests
import sys
from datetime import datetime, date
from typing import Optional

# Template mapping - All notification templates
TEMPLATES = [
    # Existing templates
    {
        'name': 'Agent Order Assigned',
        'filename': 'agent_order_assigned.html',
        'key': 'agent_order_assigned',
    },
    {
        'name': 'Business Order Confirmed',
        'filename': 'business_order_confirmed.html',
        'key': 'business_order_confirmed',
    },
    {
        'name': 'Business Order Created',
        'filename': 'business_order_created.html',
        'key': 'business_order_created',
    },
    {
        'name': 'Client Order Cancelled',
        'filename': 'client_order_cancelled.html',
        'key': 'client_order_cancelled',
    },
    {
        'name': 'Client Order Confirmed',
        'filename': 'client_order_confirmed.html',
        'key': 'client_order_confirmed',
    },
    {
        'name': 'Client Order Created',
        'filename': 'client_order_created.html',
        'key': 'client_order_created',
    },
    {
        'name': 'Client Order Delivered',
        'filename': 'client_order_delivered.html',
        'key': 'client_order_delivered',
    },
    {
        'name': 'Client Order In Transit',
        'filename': 'client_order_in_transit.html',
        'key': 'client_order_in_transit',
    },
    {
        'name': 'Client Order Out for Delivery',
        'filename': 'client_order_out_for_delivery.html',
        'key': 'client_order_out_for_delivery',
    },
    # New templates
    {
        'name': 'Client Order Preparing',
        'filename': 'client_order_preparing.html',
        'key': 'client_order_preparing',
    },
    {
        'name': 'Business Order Preparing',
        'filename': 'business_order_preparing.html',
        'key': 'business_order_preparing',
    },
    {
        'name': 'Client Order Ready for Pickup',
        'filename': 'client_order_ready_for_pickup.html',
        'key': 'client_order_ready_for_pickup',
    },
    {
        'name': 'Business Order Ready for Pickup',
        'filename': 'business_order_ready_for_pickup.html',
        'key': 'business_order_ready_for_pickup',
    },
    {
        'name': 'Client Order Picked Up',
        'filename': 'client_order_picked_up.html',
        'key': 'client_order_picked_up',
    },
    {
        'name': 'Business Order Picked Up',
        'filename': 'business_order_picked_up.html',
        'key': 'business_order_picked_up',
    },
    {
        'name': 'Agent Order Picked Up',
        'filename': 'agent_order_picked_up.html',
        'key': 'agent_order_picked_up',
    },
    {
        'name': 'Business Order In Transit',
        'filename': 'business_order_in_transit.html',
        'key': 'business_order_in_transit',
    },
    {
        'name': 'Agent Order In Transit',
        'filename': 'agent_order_in_transit.html',
        'key': 'agent_order_in_transit',
    },
    {
        'name': 'Business Order Out for Delivery',
        'filename': 'business_order_out_for_delivery.html',
        'key': 'business_order_out_for_delivery',
    },
    {
        'name': 'Agent Order Out for Delivery',
        'filename': 'agent_order_out_for_delivery.html',
        'key': 'agent_order_out_for_delivery',
    },
    {
        'name': 'Business Order Delivered',
        'filename': 'business_order_delivered.html',
        'key': 'business_order_delivered',
    },
    {
        'name': 'Agent Order Delivered',
        'filename': 'agent_order_delivered.html',
        'key': 'agent_order_delivered',
    },
    {
        'name': 'Business Order Cancelled',
        'filename': 'business_order_cancelled.html',
        'key': 'business_order_cancelled',
    },
    {
        'name': 'Agent Order Cancelled',
        'filename': 'agent_order_cancelled.html',
        'key': 'agent_order_cancelled',
    },
    {
        'name': 'Client Order Failed',
        'filename': 'client_order_failed.html',
        'key': 'client_order_failed',
    },
    {
        'name': 'Business Order Failed',
        'filename': 'business_order_failed.html',
        'key': 'business_order_failed',
    },
    {
        'name': 'Agent Order Failed',
        'filename': 'agent_order_failed.html',
        'key': 'agent_order_failed',
    },
    {
        'name': 'Client Order Refunded',
        'filename': 'client_order_refunded.html',
        'key': 'client_order_refunded',
    },
    {
        'name': 'Business Order Refunded',
        'filename': 'business_order_refunded.html',
        'key': 'business_order_refunded',
    },
    {
        'name': 'Agent Order Proximity',
        'filename': 'agent_order_proximity.html',
        'key': 'agent_order_proximity',
    },
    # French versions
    {
        'name': 'Agent Order Assigned (FR)',
        'filename': 'agent_order_assigned_fr.html',
        'key': 'agent_order_assigned_fr',
    },
    {
        'name': 'Agent Order Cancelled (FR)',
        'filename': 'agent_order_cancelled_fr.html',
        'key': 'agent_order_cancelled_fr',
    },
    {
        'name': 'Agent Order Delivered (FR)',
        'filename': 'agent_order_delivered_fr.html',
        'key': 'agent_order_delivered_fr',
    },
    {
        'name': 'Agent Order Failed (FR)',
        'filename': 'agent_order_failed_fr.html',
        'key': 'agent_order_failed_fr',
    },
    {
        'name': 'Agent Order In Transit (FR)',
        'filename': 'agent_order_in_transit_fr.html',
        'key': 'agent_order_in_transit_fr',
    },
    {
        'name': 'Agent Order Out for Delivery (FR)',
        'filename': 'agent_order_out_for_delivery_fr.html',
        'key': 'agent_order_out_for_delivery_fr',
    },
    {
        'name': 'Agent Order Picked Up (FR)',
        'filename': 'agent_order_picked_up_fr.html',
        'key': 'agent_order_picked_up_fr',
    },
    {
        'name': 'Agent Order Proximity (FR)',
        'filename': 'agent_order_proximity_fr.html',
        'key': 'agent_order_proximity_fr',
    },
    {
        'name': 'Business Order Cancelled (FR)',
        'filename': 'business_order_cancelled_fr.html',
        'key': 'business_order_cancelled_fr',
    },
    {
        'name': 'Business Order Confirmed (FR)',
        'filename': 'business_order_confirmed_fr.html',
        'key': 'business_order_confirmed_fr',
    },
    {
        'name': 'Business Order Created (FR)',
        'filename': 'business_order_created_fr.html',
        'key': 'business_order_created_fr',
    },
    {
        'name': 'Business Order Delivered (FR)',
        'filename': 'business_order_delivered_fr.html',
        'key': 'business_order_delivered_fr',
    },
    {
        'name': 'Business Order Failed (FR)',
        'filename': 'business_order_failed_fr.html',
        'key': 'business_order_failed_fr',
    },
    {
        'name': 'Business Order In Transit (FR)',
        'filename': 'business_order_in_transit_fr.html',
        'key': 'business_order_in_transit_fr',
    },
    {
        'name': 'Business Order Out for Delivery (FR)',
        'filename': 'business_order_out_for_delivery_fr.html',
        'key': 'business_order_out_for_delivery_fr',
    },
    {
        'name': 'Business Order Picked Up (FR)',
        'filename': 'business_order_picked_up_fr.html',
        'key': 'business_order_picked_up_fr',
    },
    {
        'name': 'Business Order Preparing (FR)',
        'filename': 'business_order_preparing_fr.html',
        'key': 'business_order_preparing_fr',
    },
    {
        'name': 'Business Order Ready for Pickup (FR)',
        'filename': 'business_order_ready_for_pickup_fr.html',
        'key': 'business_order_ready_for_pickup_fr',
    },
    {
        'name': 'Business Order Refunded (FR)',
        'filename': 'business_order_refunded_fr.html',
        'key': 'business_order_refunded_fr',
    },
    {
        'name': 'Client Order Cancelled (FR)',
        'filename': 'client_order_cancelled_fr.html',
        'key': 'client_order_cancelled_fr',
    },
    {
        'name': 'Client Order Confirmed (FR)',
        'filename': 'client_order_confirmed_fr.html',
        'key': 'client_order_confirmed_fr',
    },
    {
        'name': 'Client Order Created (FR)',
        'filename': 'client_order_created_fr.html',
        'key': 'client_order_created_fr',
    },
    {
        'name': 'Client Order Delivered (FR)',
        'filename': 'client_order_delivered_fr.html',
        'key': 'client_order_delivered_fr',
    },
    {
        'name': 'Client Order Failed (FR)',
        'filename': 'client_order_failed_fr.html',
        'key': 'client_order_failed_fr',
    },
    {
        'name': 'Client Order In Transit (FR)',
        'filename': 'client_order_in_transit_fr.html',
        'key': 'client_order_in_transit_fr',
    },
    {
        'name': 'Client Order Out for Delivery (FR)',
        'filename': 'client_order_out_for_delivery_fr.html',
        'key': 'client_order_out_for_delivery_fr',
    },
    {
        'name': 'Client Order Picked Up (FR)',
        'filename': 'client_order_picked_up_fr.html',
        'key': 'client_order_picked_up_fr',
    },
    {
        'name': 'Client Order Preparing (FR)',
        'filename': 'client_order_preparing_fr.html',
        'key': 'client_order_preparing_fr',
    },
    {
        'name': 'Client Order Ready for Pickup (FR)',
        'filename': 'client_order_ready_for_pickup_fr.html',
        'key': 'client_order_ready_for_pickup_fr',
    },
    {
        'name': 'Client Order Refunded (FR)',
        'filename': 'client_order_refunded_fr.html',
        'key': 'client_order_refunded_fr',
    },
]


def get_existing_templates(api_key, include_metadata=False):
    """Get all existing templates from SendGrid"""
    headers = {
        'Authorization': f'Bearer {api_key}',
        'Content-Type': 'application/json'
    }
    
    try:
        response = requests.get('https://api.sendgrid.com/v3/templates?generations=dynamic', headers=headers)
        if response.status_code == 200:
            templates = response.json().get('templates', [])
            if include_metadata:
                return templates
            return {template['name']: template['id'] for template in templates}
        else:
            print(f'⚠️ Warning: Could not fetch existing templates: {response.text}')
            return {}
    except Exception as e:
        print(f'⚠️ Warning: Error fetching existing templates: {str(e)}')
        return {}


def create_or_update_template(template, existing_templates, headers, templates_dir):
    """Create a new template or update an existing one"""
    template_name = template['name']
    template_id = existing_templates.get(template_name)
    
    # Read the HTML content
    html_path = os.path.join(templates_dir, template['filename'])
    if not os.path.exists(html_path):
        print(f'❌ Template file not found: {html_path}')
        return None
        
    with open(html_path, 'r', encoding='utf-8') as f:
        html_content = f.read()

    # Extract subject from HTML title
    import re
    title_match = re.search(r'<title>(.*?)</title>', html_content)
    subject = title_match.group(1) if title_match else template_name

    if template_id:
        # Template exists, create a new version
        print(f'🔄 Updating existing template: {template_name}')
        
        version_data = {
            'template_id': template_id,
            'active': 1,
            'name': f'{template_name} - Version {int(__import__("time").time())}',
            'subject': subject,
            'html_content': html_content,
            'generate_plain_content': True
        }

        version_response = requests.post(
            f'https://api.sendgrid.com/v3/templates/{template_id}/versions',
            headers=headers,
            json=version_data
        )

        if version_response.status_code != 201:
            print(f'❌ Failed to create template version: {version_response.text}')
            return None

        version_id = version_response.json()['id']
        print(f'✅ Template version created with ID: {version_id}')
        return template_id
    else:
        # Template doesn't exist, create it
        print(f'📧 Creating new template: {template_name}')
        
        create_data = {
            'name': template_name,
            'generation': 'dynamic'
        }

        response = requests.post(
            'https://api.sendgrid.com/v3/templates',
            headers=headers,
            json=create_data
        )

        if response.status_code != 201:
            print(f'❌ Failed to create template: {response.text}')
            return None

        template_id = response.json()['id']
        print(f'✅ Template created with ID: {template_id}')

        # Create the version with HTML content
        version_data = {
            'template_id': template_id,
            'active': 1,
            'name': f'{template_name} - Version 1',
            'subject': subject,
            'html_content': html_content,
            'generate_plain_content': True
        }

        version_response = requests.post(
            f'https://api.sendgrid.com/v3/templates/{template_id}/versions',
            headers=headers,
            json=version_data
        )

        if version_response.status_code != 201:
            print(f'❌ Failed to create template version: {version_response.text}')
            return None

        version_id = version_response.json()['id']
        print(f'✅ Template version created with ID: {version_id}')
        return template_id


def create_sendgrid_templates():
    api_key = os.getenv('SENDGRID_API_KEY')

    if not api_key:
        print("❌ SENDGRID_API_KEY environment variable is required")
        print("Please set it with: export SENDGRID_API_KEY=your_api_key_here")
        sys.exit(1)

    headers = {
        'Authorization': f'Bearer {api_key}',
        'Content-Type': 'application/json'
    }

    template_ids = {}
    templates_dir = os.path.join(os.path.dirname(__file__), 'src', 'notifications', 'templates')

    print('🚀 Processing SendGrid dynamic templates...\n')
    
    # Get existing templates
    print('📋 Fetching existing templates...')
    existing_templates = get_existing_templates(api_key)
    print(f'Found {len(existing_templates)} existing templates\n')

    for template in TEMPLATES:
        try:
            template_id = create_or_update_template(template, existing_templates, headers, templates_dir)
            if template_id:
                template_ids[template['key']] = template_id
                print(f'✅ {template["name"]} completed\n')
            else:
                print(f'❌ {template["name"]} failed\n')

        except Exception as error:
            print(f'❌ Error processing template {template["name"]}: {str(error)}\n')
            continue

    # Generate the updated templateIds object
    if template_ids:
        print('📝 Generated templateIds for notifications.service.ts:')
        print('```typescript')
        print('private readonly templateIds: Record<string, string> = {')
        for key, template_id in template_ids.items():
            print(f'  {key}: \'{template_id}\',')
        print('};')
        print('```')

        print(f'\n🎉 Successfully processed {len(template_ids)} templates!')
        print('\n📋 Next steps:')
        print('1. Copy the templateIds object above')
        print('2. Replace the templateIds in notifications.service.ts')
        print('3. Test the email notifications')
    else:
        print('❌ No templates were successfully processed')


def delete_templates_before_date(
    api_key: str,
    before_date: Optional[date] = None,
    dry_run: bool = False
) -> dict:
    """
    Delete all dynamic templates created before a certain date.
    
    Args:
        api_key: SendGrid API key
        before_date: Date to delete templates before (default: November 29, 2025)
        dry_run: If True, only show what would be deleted without actually deleting
        
    Returns:
        Dictionary with deletion results
    """
    if before_date is None:
        before_date = date(2025, 11, 29)
    
    headers = {
        'Authorization': f'Bearer {api_key}',
        'Content-Type': 'application/json'
    }
    
    print(f'🗑️  Deleting templates created before {before_date.isoformat()}')
    if dry_run:
        print('🔍 DRY RUN MODE - No templates will be deleted\n')
    
    # Get all templates with metadata
    try:
        response = requests.get('https://api.sendgrid.com/v3/templates?generations=dynamic', headers=headers)
        if response.status_code != 200:
            print(f'❌ Failed to fetch templates: {response.text}')
            return {'success': False, 'error': response.text}
        
        all_templates = response.json().get('templates', [])
        print(f'📋 Found {len(all_templates)} total templates\n')
        
        deleted_count = 0
        skipped_count = 0
        error_count = 0
        deleted_templates = []
        
        for template in all_templates:
            template_id = template.get('id')
            template_name = template.get('name', 'Unknown')
            generation = template.get('generation', '')
            
            # Only process dynamic templates
            if generation != 'dynamic':
                skipped_count += 1
                continue
            
            # Check creation date
            # SendGrid API returns 'updated_at' and 'created_at' in ISO format
            created_at_str = template.get('updated_at') or template.get('created_at')
            
            if created_at_str:
                try:
                    # Parse ISO format datetime (e.g., "2025-11-28T10:30:00Z")
                    created_at = datetime.fromisoformat(created_at_str.replace('Z', '+00:00'))
                    created_date = created_at.date()
                    
                    if created_date < before_date:
                        deleted_templates.append({
                            'id': template_id,
                            'name': template_name,
                            'created_date': created_date.isoformat()
                        })
                        
                        if not dry_run:
                            # Delete the template
                            delete_response = requests.delete(
                                f'https://api.sendgrid.com/v3/templates/{template_id}',
                                headers=headers
                            )
                            
                            if delete_response.status_code == 204:
                                deleted_count += 1
                                print(f'✅ Deleted: {template_name} (ID: {template_id}, Created: {created_date.isoformat()})')
                            else:
                                error_count += 1
                                print(f'❌ Failed to delete {template_name}: {delete_response.text}')
                        else:
                            deleted_count += 1
                            print(f'🔍 Would delete: {template_name} (ID: {template_id}, Created: {created_date.isoformat()})')
                    else:
                        skipped_count += 1
                except (ValueError, AttributeError) as e:
                    error_count += 1
                    print(f'⚠️  Could not parse date for {template_name}: {created_at_str} - {str(e)}')
                    continue
            else:
                # If no date available, skip it to be safe
                skipped_count += 1
                print(f'⚠️  No creation date found for {template_name}, skipping')
        
        print(f'\n📊 Summary:')
        print(f'   Deleted: {deleted_count}')
        print(f'   Skipped: {skipped_count}')
        print(f'   Errors: {error_count}')
        
        return {
            'success': True,
            'deleted_count': deleted_count,
            'skipped_count': skipped_count,
            'error_count': error_count,
            'deleted_templates': deleted_templates,
            'dry_run': dry_run
        }
        
    except Exception as e:
        print(f'❌ Error deleting templates: {str(e)}')
        return {'success': False, 'error': str(e)}


if __name__ == '__main__':
    if len(sys.argv) > 1 and sys.argv[1] == 'delete':
        # Delete templates mode
        api_key = os.getenv('SENDGRID_API_KEY')
        if not api_key:
            print("❌ SENDGRID_API_KEY environment variable is required")
            sys.exit(1)
        
        # Parse optional date argument (format: YYYY-MM-DD)
        before_date = None
        if len(sys.argv) > 2:
            try:
                before_date = datetime.strptime(sys.argv[2], '%Y-%m-%d').date()
            except ValueError:
                print(f'❌ Invalid date format: {sys.argv[2]}. Use YYYY-MM-DD format.')
                sys.exit(1)
        
        # Check for dry-run flag
        dry_run = '--dry-run' in sys.argv or '-n' in sys.argv
        
        delete_templates_before_date(api_key, before_date, dry_run)
    else:
        # Default: create/update templates
        create_sendgrid_templates()
