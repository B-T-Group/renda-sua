-- Remove all seeded brands data
DELETE FROM public.brands WHERE name IN (
    'McDonald''s', 'KFC', 'Starbucks', 'Coca-Cola', 'Pepsi', 'Nestlé', 'Kraft Heinz', 'Unilever', 'Danone', 'General Mills',
    'Apple', 'Samsung', 'Microsoft', 'Google', 'Sony', 'LG', 'Dell', 'HP', 'Intel', 'AMD',
    'Nike', 'Adidas', 'Puma', 'Under Armour', 'Levi''s', 'H&M', 'Zara', 'Uniqlo', 'Gap', 'Ralph Lauren',
    'L''Oréal', 'Procter & Gamble', 'Johnson & Johnson', 'Estée Lauder', 'MAC', 'Maybelline', 'Revlon', 'CoverGirl', 'Neutrogena', 'Olay',
    'Toyota', 'Honda', 'Ford', 'BMW', 'Mercedes-Benz', 'Volkswagen', 'Audi', 'Hyundai', 'Kia', 'Tesla',
    'IKEA', 'Home Depot', 'Lowe''s', 'Target', 'Walmart', 'Costco', 'Best Buy', 'Amazon', 'eBay', 'Alibaba',
    'The North Face', 'Patagonia', 'Columbia', 'Nike Golf', 'Callaway', 'Wilson', 'Spalding', 'Rawlings', 'Easton', 'Reebok',
    'Gucci', 'Louis Vuitton', 'Chanel', 'Hermès', 'Prada', 'Burberry', 'Cartier', 'Rolex', 'Omega', 'Tiffany & Co.',
    'PlayStation', 'Xbox', 'Nintendo', 'Electronic Arts', 'Activision Blizzard', 'Ubisoft', 'Rockstar Games', 'Valve', 'Steam', 'Epic Games',
    'MTN', 'Airtel', 'Vodafone', 'Orange', 'T-Mobile', 'Verizon', 'AT&T', 'Comcast', 'Netflix', 'Disney'
); 