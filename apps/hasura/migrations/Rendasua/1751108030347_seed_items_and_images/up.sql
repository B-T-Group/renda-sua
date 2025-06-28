-- Seed items table with diverse products across all categories
INSERT INTO public.items (name, description, item_sub_category_id, size, size_unit, weight, weight_unit, price, currency, sku, brand, model, color, material, is_fragile, is_perishable, requires_special_handling, max_delivery_distance, estimated_delivery_time, min_order_quantity, max_order_quantity) VALUES

-- Food & Beverages - Fast Food (category 1, sub-category 1)
('Classic Cheeseburger', 'Juicy beef patty with cheese, lettuce, tomato, and special sauce', 1, 15.0, 'cm', 250.0, 'g', 8.99, 'USD', 'FB-001', 'BurgerHouse', 'CH-001', 'Brown', 'Beef', FALSE, TRUE, FALSE, 20, 45, 1, 10),
('Pepperoni Pizza', 'Traditional pizza with pepperoni, mozzarella, and tomato sauce', 1, 30.0, 'cm', 800.0, 'g', 18.99, 'USD', 'FB-002', 'PizzaPalace', 'PP-001', 'Red', 'Dough', FALSE, TRUE, FALSE, 25, 60, 1, 5),
('Chicken Wings', 'Crispy fried chicken wings with buffalo sauce', 1, 8.0, 'cm', 300.0, 'g', 12.99, 'USD', 'FB-003', 'WingMaster', 'CW-001', 'Orange', 'Chicken', FALSE, TRUE, FALSE, 15, 30, 1, 8),

-- Food & Beverages - Restaurant Meals (category 1, sub-category 2)
('Grilled Salmon', 'Fresh Atlantic salmon with herbs and lemon', 2, 20.0, 'cm', 400.0, 'g', 28.99, 'USD', 'FB-004', 'OceanFresh', 'GS-001', 'Pink', 'Fish', FALSE, TRUE, TRUE, 30, 90, 1, 3),
('Beef Steak', 'Premium cut beef steak with garlic butter', 2, 25.0, 'cm', 350.0, 'g', 35.99, 'USD', 'FB-005', 'PrimeCuts', 'BS-001', 'Brown', 'Beef', FALSE, TRUE, TRUE, 25, 75, 1, 2),
('Pasta Carbonara', 'Creamy pasta with bacon and parmesan', 2, 18.0, 'cm', 450.0, 'g', 16.99, 'USD', 'FB-006', 'ItalianDelight', 'PC-001', 'Yellow', 'Pasta', FALSE, TRUE, FALSE, 20, 60, 1, 4),

-- Food & Beverages - Beverages (category 1, sub-category 3)
('Fresh Orange Juice', '100% natural orange juice', 3, 15.0, 'cm', 500.0, 'g', 4.99, 'USD', 'FB-007', 'FreshSqueeze', 'OJ-001', 'Orange', 'Glass', TRUE, TRUE, FALSE, 15, 30, 1, 6),
('Espresso Coffee', 'Strong Italian espresso', 3, 8.0, 'cm', 30.0, 'g', 3.99, 'USD', 'FB-008', 'CoffeeBean', 'EC-001', 'Brown', 'Coffee', FALSE, TRUE, FALSE, 10, 20, 1, 10),
('Green Tea', 'Organic green tea with antioxidants', 3, 12.0, 'cm', 250.0, 'g', 2.99, 'USD', 'FB-009', 'TeaGarden', 'GT-001', 'Green', 'Tea', FALSE, TRUE, FALSE, 12, 25, 1, 8),

-- Food & Beverages - Desserts (category 1, sub-category 4)
('Chocolate Cake', 'Rich chocolate cake with ganache', 4, 20.0, 'cm', 600.0, 'g', 22.99, 'USD', 'FB-010', 'SweetTreats', 'CC-001', 'Brown', 'Chocolate', TRUE, TRUE, TRUE, 20, 45, 1, 3),
('Vanilla Ice Cream', 'Creamy vanilla ice cream', 4, 15.0, 'cm', 400.0, 'g', 8.99, 'USD', 'FB-011', 'FrozenDelight', 'VI-001', 'White', 'Cream', TRUE, TRUE, TRUE, 15, 30, 1, 5),
('Apple Pie', 'Traditional apple pie with cinnamon', 4, 25.0, 'cm', 500.0, 'g', 15.99, 'USD', 'FB-012', 'BakeryFresh', 'AP-001', 'Golden', 'Pastry', TRUE, TRUE, TRUE, 18, 40, 1, 4),

-- Food & Beverages - Groceries (category 1, sub-category 5)
('Organic Bananas', 'Fresh organic bananas', 5, 18.0, 'cm', 500.0, 'g', 3.99, 'USD', 'FB-013', 'OrganicFarm', 'OB-001', 'Yellow', 'Fruit', FALSE, TRUE, FALSE, 25, 60, 1, 10),
('Fresh Milk', 'Farm fresh whole milk', 5, 20.0, 'cm', 1000.0, 'g', 4.99, 'USD', 'FB-014', 'DairyFresh', 'FM-001', 'White', 'Milk', TRUE, TRUE, FALSE, 20, 45, 1, 6),
('Chicken Breast', 'Boneless skinless chicken breast', 5, 15.0, 'cm', 400.0, 'g', 12.99, 'USD', 'FB-015', 'MeatMarket', 'CB-001', 'Pink', 'Chicken', FALSE, TRUE, FALSE, 30, 75, 1, 5),

-- Retail & Shopping - Electronics (category 2, sub-category 6)
('iPhone 15 Pro', 'Latest iPhone with advanced camera system', 6, 15.0, 'cm', 187.0, 'g', 999.99, 'USD', 'RS-001', 'Apple', 'IP15P-001', 'Titanium', 'Metal', TRUE, FALSE, TRUE, 50, 120, 1, 2),
('MacBook Air', 'Lightweight laptop with M2 chip', 6, 30.0, 'cm', 1300.0, 'g', 1199.99, 'USD', 'RS-002', 'Apple', 'MBA-001', 'Silver', 'Aluminum', TRUE, FALSE, TRUE, 50, 120, 1, 1),
('Samsung TV 55"', '4K Smart TV with HDR', 6, 120.0, 'cm', 15000.0, 'g', 699.99, 'USD', 'RS-003', 'Samsung', 'TV55-001', 'Black', 'Plastic', TRUE, FALSE, TRUE, 40, 90, 1, 1),

-- Retail & Shopping - Clothing & Fashion (category 2, sub-category 7)
('Denim Jeans', 'Classic blue denim jeans', 7, 100.0, 'cm', 500.0, 'g', 89.99, 'USD', 'RS-004', 'Levi''s', 'DJ-001', 'Blue', 'Denim', FALSE, FALSE, FALSE, 30, 60, 1, 5),
('Cotton T-Shirt', 'Comfortable cotton t-shirt', 7, 70.0, 'cm', 200.0, 'g', 24.99, 'USD', 'RS-005', 'Nike', 'CTS-001', 'White', 'Cotton', FALSE, FALSE, FALSE, 25, 45, 1, 10),
('Leather Jacket', 'Premium leather motorcycle jacket', 7, 80.0, 'cm', 1200.0, 'g', 299.99, 'USD', 'RS-006', 'Harley', 'LJ-001', 'Black', 'Leather', FALSE, FALSE, FALSE, 35, 75, 1, 3),

-- Retail & Shopping - Home & Garden (category 2, sub-category 8)
('Coffee Table', 'Modern wooden coffee table', 8, 120.0, 'cm', 15000.0, 'g', 299.99, 'USD', 'RS-007', 'IKEA', 'CT-001', 'Brown', 'Wood', TRUE, FALSE, TRUE, 40, 90, 1, 1),
('Garden Plant', 'Indoor potted plant', 8, 50.0, 'cm', 2000.0, 'g', 39.99, 'USD', 'RS-008', 'GreenThumb', 'GP-001', 'Green', 'Plant', TRUE, FALSE, FALSE, 25, 60, 1, 5),
('Wall Clock', 'Elegant wall clock', 8, 30.0, 'cm', 500.0, 'g', 79.99, 'USD', 'RS-009', 'TimeCraft', 'WC-001', 'Silver', 'Metal', TRUE, FALSE, FALSE, 20, 45, 1, 3),

-- Retail & Shopping - Books & Media (category 2, sub-category 9)
('Programming Book', 'Learn Python programming', 9, 25.0, 'cm', 800.0, 'g', 49.99, 'USD', 'RS-010', 'TechBooks', 'PB-001', 'Blue', 'Paper', FALSE, FALSE, FALSE, 30, 60, 1, 10),
('Bluetooth Headphones', 'Wireless noise-canceling headphones', 9, 20.0, 'cm', 250.0, 'g', 199.99, 'USD', 'RS-011', 'Sony', 'BH-001', 'Black', 'Plastic', TRUE, FALSE, FALSE, 25, 45, 1, 5),
('Gaming Console', 'Next-gen gaming console', 9, 40.0, 'cm', 4500.0, 'g', 499.99, 'USD', 'RS-012', 'PlayStation', 'GC-001', 'White', 'Plastic', TRUE, FALSE, TRUE, 35, 75, 1, 1),

-- Retail & Shopping - Sports & Outdoor (category 2, sub-category 10)
('Running Shoes', 'Professional running shoes', 10, 30.0, 'cm', 300.0, 'g', 129.99, 'USD', 'RS-013', 'Adidas', 'RS-001', 'Blue', 'Mesh', FALSE, FALSE, FALSE, 30, 60, 1, 5),
('Tennis Racket', 'Professional tennis racket', 10, 70.0, 'cm', 300.0, 'g', 199.99, 'USD', 'RS-014', 'Wilson', 'TR-001', 'Black', 'Graphite', TRUE, FALSE, FALSE, 25, 45, 1, 3),
('Camping Tent', '4-person camping tent', 10, 200.0, 'cm', 5000.0, 'g', 299.99, 'USD', 'RS-015', 'OutdoorGear', 'CT-001', 'Green', 'Nylon', TRUE, FALSE, TRUE, 40, 90, 1, 2),

-- Health & Beauty - Cosmetics (category 3, sub-category 11)
('Lipstick', 'Long-lasting matte lipstick', 11, 8.0, 'cm', 15.0, 'g', 24.99, 'USD', 'HB-001', 'MAC', 'L-001', 'Red', 'Wax', FALSE, FALSE, FALSE, 20, 45, 1, 10),
('Foundation', 'Full coverage foundation', 11, 12.0, 'cm', 30.0, 'g', 39.99, 'USD', 'HB-002', 'Estee Lauder', 'F-001', 'Beige', 'Liquid', TRUE, FALSE, FALSE, 20, 45, 1, 5),
('Eye Shadow Palette', 'Professional eye shadow palette', 11, 15.0, 'cm', 50.0, 'g', 59.99, 'USD', 'HB-003', 'Urban Decay', 'ESP-001', 'Multi', 'Powder', TRUE, FALSE, FALSE, 20, 45, 1, 3),

-- Health & Beauty - Pharmaceuticals (category 3, sub-category 12)
('Pain Reliever', 'Ibuprofen tablets', 12, 8.0, 'cm', 50.0, 'g', 12.99, 'USD', 'HB-004', 'Tylenol', 'PR-001', 'White', 'Tablet', FALSE, FALSE, FALSE, 30, 60, 1, 10),
('Vitamin C', 'Vitamin C supplements', 12, 10.0, 'cm', 100.0, 'g', 19.99, 'USD', 'HB-005', 'NatureMade', 'VC-001', 'Orange', 'Capsule', FALSE, FALSE, FALSE, 25, 45, 1, 8),
('First Aid Kit', 'Complete first aid kit', 12, 25.0, 'cm', 500.0, 'g', 49.99, 'USD', 'HB-006', 'Johnson', 'FAK-001', 'Red', 'Plastic', FALSE, FALSE, FALSE, 30, 60, 1, 3),

-- Health & Beauty - Personal Care (category 3, sub-category 13)
('Shampoo', 'Moisturizing shampoo', 13, 20.0, 'cm', 500.0, 'g', 15.99, 'USD', 'HB-007', 'Pantene', 'S-001', 'Blue', 'Liquid', TRUE, FALSE, FALSE, 20, 45, 1, 8),
('Toothbrush', 'Electric toothbrush', 13, 25.0, 'cm', 150.0, 'g', 89.99, 'USD', 'HB-008', 'Oral-B', 'TB-001', 'White', 'Plastic', TRUE, FALSE, FALSE, 20, 45, 1, 5),
('Deodorant', 'Long-lasting deodorant', 13, 15.0, 'cm', 100.0, 'g', 8.99, 'USD', 'HB-009', 'Dove', 'D-001', 'White', 'Stick', FALSE, FALSE, FALSE, 15, 30, 1, 10),

-- Health & Beauty - Wellness (category 3, sub-category 14)
('Yoga Mat', 'Non-slip yoga mat', 14, 180.0, 'cm', 1500.0, 'g', 39.99, 'USD', 'HB-010', 'Lululemon', 'YM-001', 'Purple', 'Rubber', FALSE, FALSE, FALSE, 25, 60, 1, 5),
('Protein Powder', 'Whey protein powder', 14, 25.0, 'cm', 1000.0, 'g', 49.99, 'USD', 'HB-011', 'Optimum', 'PP-001', 'Vanilla', 'Powder', FALSE, FALSE, FALSE, 30, 60, 1, 8),
('Meditation Cushion', 'Comfortable meditation cushion', 14, 40.0, 'cm', 800.0, 'g', 29.99, 'USD', 'HB-012', 'ZenLife', 'MC-001', 'Blue', 'Cotton', FALSE, FALSE, FALSE, 20, 45, 1, 5),

-- Services - Document Delivery (category 4, sub-category 15)
('Legal Contract', 'Important legal document delivery', 15, 30.0, 'cm', 100.0, 'g', 25.99, 'USD', 'SV-001', 'LegalDocs', 'LC-001', 'White', 'Paper', FALSE, FALSE, TRUE, 50, 120, 1, 1),
('Business Proposal', 'Confidential business proposal', 15, 25.0, 'cm', 150.0, 'g', 19.99, 'USD', 'SV-002', 'BusinessCorp', 'BP-001', 'White', 'Paper', FALSE, FALSE, TRUE, 40, 90, 1, 1),
('Medical Records', 'Sensitive medical documents', 15, 20.0, 'cm', 80.0, 'g', 35.99, 'USD', 'SV-003', 'MedCenter', 'MR-001', 'White', 'Paper', FALSE, FALSE, TRUE, 60, 180, 1, 1),

-- Services - Package Pickup (category 4, sub-category 16)
('E-commerce Return', 'Online purchase return package', 16, 40.0, 'cm', 2000.0, 'g', 15.99, 'USD', 'SV-004', 'ReturnService', 'ER-001', 'Brown', 'Cardboard', FALSE, FALSE, FALSE, 30, 60, 1, 5),
('Personal Package', 'Personal item pickup service', 16, 30.0, 'cm', 1500.0, 'g', 12.99, 'USD', 'SV-005', 'PersonalPickup', 'PP-001', 'Mixed', 'Mixed', FALSE, FALSE, FALSE, 25, 45, 1, 3),
('Gift Package', 'Gift wrapping and delivery', 16, 35.0, 'cm', 1000.0, 'g', 22.99, 'USD', 'SV-006', 'GiftService', 'GP-001', 'Colorful', 'Paper', TRUE, FALSE, FALSE, 30, 75, 1, 3),

-- Services - Special Delivery (category 4, sub-category 17)
('Bouquet of Roses', 'Fresh red roses bouquet', 17, 60.0, 'cm', 800.0, 'g', 79.99, 'USD', 'SV-007', 'FlowerShop', 'BR-001', 'Red', 'Flowers', TRUE, TRUE, TRUE, 25, 60, 1, 3),
('Birthday Cake', 'Custom birthday cake', 17, 25.0, 'cm', 1500.0, 'g', 45.99, 'USD', 'SV-008', 'CakeBakery', 'BC-001', 'Multi', 'Cake', TRUE, TRUE, TRUE, 20, 45, 1, 2),
('Anniversary Gift', 'Special anniversary gift package', 17, 30.0, 'cm', 1200.0, 'g', 99.99, 'USD', 'SV-009', 'GiftBoutique', 'AG-001', 'Gold', 'Mixed', TRUE, FALSE, TRUE, 30, 75, 1, 2),

-- Services - Express Delivery (category 4, sub-category 18)
('Urgent Documents', 'Same-day document delivery', 18, 25.0, 'cm', 100.0, 'g', 49.99, 'USD', 'SV-010', 'ExpressDocs', 'UD-001', 'White', 'Paper', FALSE, FALSE, TRUE, 100, 240, 1, 1),
('Emergency Package', 'Emergency package delivery', 18, 40.0, 'cm', 3000.0, 'g', 89.99, 'USD', 'SV-011', 'EmergencyDel', 'EP-001', 'Mixed', 'Mixed', FALSE, FALSE, TRUE, 80, 180, 1, 2),
('Time-Sensitive Item', 'Critical time-sensitive delivery', 18, 35.0, 'cm', 2000.0, 'g', 129.99, 'USD', 'SV-012', 'CriticalDel', 'TSI-001', 'Mixed', 'Mixed', FALSE, FALSE, TRUE, 120, 300, 1, 1),

-- Industrial & Business - Office Supplies (category 5, sub-category 19)
('Laptop Stand', 'Adjustable laptop stand', 19, 30.0, 'cm', 800.0, 'g', 49.99, 'USD', 'IB-001', 'OfficePro', 'LS-001', 'Silver', 'Aluminum', FALSE, FALSE, FALSE, 30, 60, 1, 5),
('Wireless Mouse', 'Ergonomic wireless mouse', 19, 12.0, 'cm', 100.0, 'g', 29.99, 'USD', 'IB-002', 'Logitech', 'WM-001', 'Black', 'Plastic', TRUE, FALSE, FALSE, 25, 45, 1, 10),
('Desk Organizer', 'Multi-compartment desk organizer', 19, 25.0, 'cm', 500.0, 'g', 39.99, 'USD', 'IB-003', 'OrganizeIt', 'DO-001', 'Black', 'Plastic', FALSE, FALSE, FALSE, 20, 45, 1, 5),

-- Industrial & Business - Industrial Parts (category 5, sub-category 20)
('Steel Bearings', 'High-quality steel bearings', 20, 5.0, 'cm', 200.0, 'g', 89.99, 'USD', 'IB-004', 'IndustrialParts', 'SB-001', 'Silver', 'Steel', FALSE, FALSE, FALSE, 50, 120, 1, 20),
('Hydraulic Pump', 'Industrial hydraulic pump', 20, 40.0, 'cm', 15000.0, 'g', 599.99, 'USD', 'IB-005', 'HydraulicCorp', 'HP-001', 'Blue', 'Metal', TRUE, FALSE, TRUE, 60, 180, 1, 2),
('Circuit Board', 'Electronic circuit board', 20, 15.0, 'cm', 100.0, 'g', 199.99, 'USD', 'IB-006', 'ElectroTech', 'CB-001', 'Green', 'Fiberglass', TRUE, FALSE, TRUE, 40, 90, 1, 10),

-- Industrial & Business - Business Documents (category 5, sub-category 21)
('Financial Report', 'Quarterly financial report', 21, 30.0, 'cm', 500.0, 'g', 15.99, 'USD', 'IB-007', 'FinanceCorp', 'FR-001', 'White', 'Paper', FALSE, FALSE, TRUE, 40, 90, 1, 1),
('Contract Bundle', 'Multiple business contracts', 21, 25.0, 'cm', 300.0, 'g', 25.99, 'USD', 'IB-008', 'LegalCorp', 'CB-001', 'White', 'Paper', FALSE, FALSE, TRUE, 35, 75, 1, 1),
('Proposal Package', 'Business proposal documents', 21, 20.0, 'cm', 200.0, 'g', 19.99, 'USD', 'IB-009', 'BusinessCorp', 'PP-001', 'White', 'Paper', FALSE, FALSE, TRUE, 30, 60, 1, 1),

-- Industrial & Business - Equipment Rental (category 5, sub-category 22)
('Forklift Rental', 'Industrial forklift rental', 22, 300.0, 'cm', 5000000.0, 'g', 299.99, 'USD', 'IB-010', 'RentalCorp', 'FR-001', 'Yellow', 'Metal', TRUE, FALSE, TRUE, 80, 240, 1, 1),
('Generator Rental', 'Portable generator rental', 22, 150.0, 'cm', 100000.0, 'g', 199.99, 'USD', 'IB-011', 'PowerRent', 'GR-001', 'Red', 'Metal', TRUE, FALSE, TRUE, 60, 180, 1, 1),
('Scaffolding Rental', 'Construction scaffolding rental', 22, 600.0, 'cm', 1000000.0, 'g', 399.99, 'USD', 'IB-012', 'BuildRent', 'SR-001', 'Silver', 'Metal', TRUE, FALSE, TRUE, 70, 210, 1, 1);

-- Seed item_images table with sample images for the items
INSERT INTO public.item_images (item_id, image_url, image_type, alt_text, caption, display_order, file_size, width, height, format) VALUES
-- Sample images for first few items (you can expand this pattern)
((SELECT id FROM public.items WHERE sku = 'FB-001' LIMIT 1), 'https://example.com/images/burger-main.jpg', 'main', 'Classic Cheeseburger', 'Delicious cheeseburger with fresh ingredients', 1, 2048000, 800, 600, 'jpg'),
((SELECT id FROM public.items WHERE sku = 'FB-001' LIMIT 1), 'https://example.com/images/burger-angle.jpg', 'angle', 'Cheeseburger side view', 'Side view of the cheeseburger', 2, 1536000, 600, 800, 'jpg'),
((SELECT id FROM public.items WHERE sku = 'RS-001' LIMIT 1), 'https://example.com/images/iphone-main.jpg', 'main', 'iPhone 15 Pro', 'Latest iPhone with advanced features', 1, 3072000, 1200, 900, 'jpg'),
((SELECT id FROM public.items WHERE sku = 'RS-001' LIMIT 1), 'https://example.com/images/iphone-detail.jpg', 'detail', 'iPhone camera detail', 'Close-up of the camera system', 2, 2048000, 800, 600, 'jpg'),
((SELECT id FROM public.items WHERE sku = 'HB-001' LIMIT 1), 'https://example.com/images/lipstick-main.jpg', 'main', 'MAC Lipstick', 'Long-lasting matte lipstick', 1, 1024000, 600, 800, 'jpg'),
((SELECT id FROM public.items WHERE sku = 'SV-007' LIMIT 1), 'https://example.com/images/roses-main.jpg', 'main', 'Bouquet of Roses', 'Beautiful red roses bouquet', 1, 2560000, 1000, 750, 'jpg'),
((SELECT id FROM public.items WHERE sku = 'IB-001' LIMIT 1), 'https://example.com/images/laptop-stand-main.jpg', 'main', 'Laptop Stand', 'Adjustable laptop stand', 1, 1536000, 800, 600, 'jpg');
