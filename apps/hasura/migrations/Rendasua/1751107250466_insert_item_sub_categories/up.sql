-- Insert item sub-categories for delivery service
INSERT INTO public.item_sub_categories (item_category_id, name, description) VALUES
-- Food & Beverages (category_id: 1)
(1, 'Fast Food', 'Burgers, pizza, fried chicken, and quick meals'),
(1, 'Restaurant Meals', 'Fine dining, casual dining, and sit-down restaurant food'),
(1, 'Beverages', 'Soft drinks, coffee, tea, juices, and other drinks'),
(1, 'Desserts', 'Ice cream, cakes, pastries, and sweet treats'),
(1, 'Groceries', 'Fresh produce, dairy, meat, and household groceries'),

-- Retail & Shopping (category_id: 2)
(2, 'Electronics', 'Phones, laptops, accessories, and electronic devices'),
(2, 'Clothing & Fashion', 'Men''s, women''s, kids'' clothing and fashion items'),
(2, 'Home & Garden', 'Furniture, decor, plants, and home improvement items'),
(2, 'Books & Media', 'Books, movies, music, and entertainment media'),
(2, 'Sports & Outdoor', 'Sports equipment, outdoor gear, and athletic apparel'),

-- Health & Beauty (category_id: 3)
(3, 'Cosmetics', 'Makeup, skincare, haircare, and beauty products'),
(3, 'Pharmaceuticals', 'Medicines, vitamins, first aid, and health supplements'),
(3, 'Personal Care', 'Hygiene products, grooming items, and personal care'),
(3, 'Wellness', 'Health supplements, fitness products, and wellness items'),

-- Services (category_id: 4)
(4, 'Document Delivery', 'Legal papers, contracts, and important documents'),
(4, 'Package Pickup', 'E-commerce returns, personal items, and package collection'),
(4, 'Special Delivery', 'Flowers, gifts, cakes, and special occasion items'),
(4, 'Express Delivery', 'Urgent items, time-sensitive deliveries, and priority services'),

-- Industrial & Business (category_id: 5)
(5, 'Office Supplies', 'Stationery, office equipment, and business supplies'),
(5, 'Industrial Parts', 'Machinery parts, tools, and industrial equipment'),
(5, 'Business Documents', 'Contracts, reports, and business paperwork'),
(5, 'Equipment Rental', 'Tools, machinery, and equipment rental services');
