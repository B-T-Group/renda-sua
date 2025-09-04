#!/usr/bin/env python3

import os
import json
import requests
import sys

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
]


def get_existing_templates(api_key):
    """Get all existing templates from SendGrid"""
    headers = {
        'Authorization': f'Bearer {api_key}',
        'Content-Type': 'application/json'
    }
    
    try:
        response = requests.get('https://api.sendgrid.com/v3/templates', headers=headers)
        if response.status_code == 200:
            templates = response.json().get('templates', [])
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


if __name__ == '__main__':
    create_sendgrid_templates()
