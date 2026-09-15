-- Database: tripforsoul-admin (PostgreSQL)

-- Admin users table
CREATE TABLE IF NOT EXISTS admins (
  id SERIAL PRIMARY KEY,
  username VARCHAR(100) NOT NULL UNIQUE,
  email VARCHAR(255) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  role VARCHAR(50) DEFAULT 'staff',
  permissions JSONB,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default admin (password: admin123)
INSERT INTO admins (username, email, password, role) VALUES
('admin', 'admin@tripforsoul.com', '$2a$10$8KzQMGx5C5Kc5Q5Q5Q5Q5u5Q5Q5Q5Q5Q5Q5Q5Q5Q5Q5Q5Q5Q5Q5Q', 'admin')
ON CONFLICT (username) DO NOTHING;

-- Banner settings
CREATE TABLE IF NOT EXISTS banner_settings (
  id SERIAL PRIMARY KEY,
  heading VARCHAR(255) DEFAULT 'Journeys Crafted for the Soul',
  subtitle TEXT DEFAULT 'Not just another trip. We design meaningful land journeys that connect you with culture, people, and places beyond the tourist trail.',
  button1_text VARCHAR(100) DEFAULT 'Find Now',
  button2_text VARCHAR(100) DEFAULT 'View All Packages',
  button2_link VARCHAR(255) DEFAULT '/packages',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO banner_settings (heading, subtitle)
SELECT 'Journeys Crafted for the Soul', 'Not just another trip. We design meaningful land journeys that connect you with culture, people, and places beyond the tourist trail.'
WHERE NOT EXISTS (SELECT 1 FROM banner_settings);

-- Banner images
CREATE TABLE IF NOT EXISTS banner_images (
  id SERIAL PRIMARY KEY,
  image_url TEXT NOT NULL,
  mobile_image_url TEXT DEFAULT '',
  sort_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Alter existing tables to support base64 images (TEXT instead of VARCHAR)
ALTER TABLE IF EXISTS banner_images ALTER COLUMN image_url TYPE TEXT;
ALTER TABLE IF EXISTS banner_images ADD COLUMN IF NOT EXISTS mobile_image_url TEXT DEFAULT '';
ALTER TABLE IF EXISTS trending_items ALTER COLUMN image_url TYPE TEXT;
ALTER TABLE IF EXISTS popular_destinations ALTER COLUMN image_url TYPE TEXT;
ALTER TABLE IF EXISTS trips ALTER COLUMN image_url TYPE TEXT;
ALTER TABLE IF EXISTS destinations ALTER COLUMN image_url TYPE TEXT;
ALTER TABLE IF EXISTS packages ALTER COLUMN image_url TYPE TEXT;
ALTER TABLE IF EXISTS packages ADD COLUMN IF NOT EXISTS price_usd VARCHAR(50) DEFAULT '';
ALTER TABLE IF EXISTS packages ADD COLUMN IF NOT EXISTS price_inr VARCHAR(50) DEFAULT '';
ALTER TABLE IF EXISTS packages ADD COLUMN IF NOT EXISTS price_eur VARCHAR(50) DEFAULT '';
ALTER TABLE IF EXISTS destinations ADD COLUMN IF NOT EXISTS price_usd VARCHAR(50) DEFAULT '';
ALTER TABLE IF EXISTS destinations ADD COLUMN IF NOT EXISTS price_inr VARCHAR(50) DEFAULT '';
ALTER TABLE IF EXISTS destinations ADD COLUMN IF NOT EXISTS price_eur VARCHAR(50) DEFAULT '';
ALTER TABLE IF EXISTS destinations ADD COLUMN IF NOT EXISTS gallery_images JSONB;
ALTER TABLE IF EXISTS packages ADD COLUMN IF NOT EXISTS gallery_images JSONB;
ALTER TABLE IF EXISTS testimonials ALTER COLUMN image_url TYPE TEXT;
ALTER TABLE IF EXISTS about_us ALTER COLUMN image_url TYPE TEXT;
ALTER TABLE IF EXISTS about_us ALTER COLUMN experience_image TYPE TEXT;
ALTER TABLE IF EXISTS about_us ALTER COLUMN why_image TYPE TEXT;
ALTER TABLE IF EXISTS about_us ALTER COLUMN promise_image TYPE TEXT;
ALTER TABLE IF EXISTS about_us ALTER COLUMN difference_image TYPE TEXT;
ALTER TABLE IF EXISTS page_banners ALTER COLUMN background_image TYPE TEXT;
ALTER TABLE IF EXISTS team_members ALTER COLUMN image_url TYPE TEXT;
ALTER TABLE IF EXISTS gallery_images ALTER COLUMN image_url TYPE TEXT;
ALTER TABLE IF EXISTS blogs ALTER COLUMN cover_image TYPE TEXT;
ALTER TABLE IF EXISTS services ALTER COLUMN image_url TYPE TEXT;
ALTER TABLE IF EXISTS offers ALTER COLUMN image_url TYPE TEXT;

-- Trending section control
CREATE TABLE IF NOT EXISTS trending_settings (
  id SERIAL PRIMARY KEY,
  is_enabled BOOLEAN DEFAULT true,
  heading VARCHAR(255) DEFAULT 'Trending Now',
  subtitle TEXT DEFAULT 'Most sought-after destinations this season',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO trending_settings (is_enabled, heading, subtitle)
SELECT true, 'Trending Now', 'Most sought-after destinations this season'
WHERE NOT EXISTS (SELECT 1 FROM trending_settings);

-- Trending items
CREATE TABLE IF NOT EXISTS trending_items (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  image_url VARCHAR(500) NOT NULL,
  region VARCHAR(100) DEFAULT '',
  price VARCHAR(50) DEFAULT '',
  badge VARCHAR(100) DEFAULT '',
  sort_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Region pricing
CREATE TABLE IF NOT EXISTS region_pricing (
  id SERIAL PRIMARY KEY,
  region VARCHAR(100) NOT NULL UNIQUE,
  starting_price VARCHAR(50) NOT NULL,
  currency VARCHAR(10) DEFAULT 'USD',
  usd_price VARCHAR(50) DEFAULT '',
  is_active BOOLEAN DEFAULT true,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO region_pricing (region, starting_price, currency) VALUES
('Asia', '$799', 'USD'),
('Europe', '$1,499', 'USD'),
('Middle East', '$999', 'USD'),
('Africa', '$1,299', 'USD'),
('Americas', '$1,199', 'USD')
ON CONFLICT (region) DO NOTHING;

-- Popular destinations
CREATE TABLE IF NOT EXISTS popular_destinations (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  image_url VARCHAR(500) NOT NULL,
  region VARCHAR(100) DEFAULT '',
  price VARCHAR(50) DEFAULT '',
  sort_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Homepage sections
CREATE TABLE IF NOT EXISTS homepage_sections (
  id SERIAL PRIMARY KEY,
  section_key VARCHAR(100) NOT NULL UNIQUE,
  section_name VARCHAR(255) NOT NULL,
  is_visible BOOLEAN DEFAULT true,
  sort_order INT DEFAULT 0,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO homepage_sections (section_key, section_name, sort_order) VALUES
('banner', 'Banner', 1),
('about_us', 'About Us', 2),
('trending', 'Trending Now', 3),
('popular_destinations', 'Popular Destinations', 4),
('spiritual_escape', 'Spiritual Escape', 5),
('features', 'Features', 6),
('testimonials', 'Testimonials', 7),
('gallery', 'Gallery', 8),
('deals', 'Deals', 9),
('footer', 'Footer', 10)
ON CONFLICT (section_key) DO NOTHING;

-- Deals section
CREATE TABLE IF NOT EXISTS deals_settings (
  id SERIAL PRIMARY KEY,
  tagline VARCHAR(255) DEFAULT 'Travel offers',
  heading VARCHAR(255) DEFAULT 'Make more of every journey.',
  description TEXT DEFAULT 'Discover current seasonal offers and speak with our team to find the journey that suits your plans.',
  button_text VARCHAR(100) DEFAULT 'Ask about offers',
  button_link VARCHAR(255) DEFAULT '/contact?subject=Offer%20enquiry',
  card_tagline VARCHAR(255) DEFAULT 'Planning made personal',
  card_heading TEXT DEFAULT 'Get a tailored recommendation, clear inclusions, and expert support before you book.',
  card_description TEXT DEFAULT 'Offer availability and final pricing are confirmed by the travel team.',
  is_active BOOLEAN DEFAULT true,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO deals_settings (tagline, heading, description, button_text, button_link, card_tagline, card_heading, card_description, is_active)
SELECT 'Travel offers', 'Make more of every journey.', 'Discover current seasonal offers and speak with our team to find the journey that suits your plans.', 'Ask about offers', '/contact?subject=Offer%20enquiry', 'Planning made personal', 'Get a tailored recommendation, clear inclusions, and expert support before you book.', 'Offer availability and final pricing are confirmed by the travel team.', true
WHERE NOT EXISTS (SELECT 1 FROM deals_settings);

-- Sticky offers shown across the customer-facing website
CREATE TABLE IF NOT EXISTS offers (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT DEFAULT '',
  image_url TEXT DEFAULT '',
  button_text VARCHAR(100) DEFAULT 'Explore offer',
  button_link VARCHAR(500) DEFAULT '/contact',
  badge VARCHAR(100) DEFAULT '',
  coupon_code VARCHAR(100) DEFAULT '',
  travel_start_date DATE,
  travel_end_date DATE,
  duration_days INTEGER,
  duration TEXT,
  sort_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS leads (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  first_name VARCHAR(255) DEFAULT '',
  middle_name VARCHAR(255) DEFAULT '',
  last_name VARCHAR(255) DEFAULT '',
  email VARCHAR(255) DEFAULT '',
  phone VARCHAR(100) DEFAULT '',
  destination VARCHAR(255) DEFAULT '',
  package_name VARCHAR(255) DEFAULT '',
  date VARCHAR(100) DEFAULT '',
  travel_start_date DATE,
  travel_end_date DATE,
  travel_style VARCHAR(255) DEFAULT '',
  trip_budget VARCHAR(255) DEFAULT '',
  receive_offers BOOLEAN DEFAULT false,
  travellers VARCHAR(100) DEFAULT '',
  message TEXT DEFAULT '',
  additional_information TEXT DEFAULT '',
  coupon_code VARCHAR(100) DEFAULT '',
  offer_duration TEXT,
  offer_duration_days INTEGER,
  source VARCHAR(100) DEFAULT 'website',
  service_type VARCHAR(100) DEFAULT '',
  source_page VARCHAR(500) DEFAULT '',
  nationality VARCHAR(255) DEFAULT '',
  travel_intent VARCHAR(255) DEFAULT '',
  financial_sponsorship_info TEXT DEFAULT '',
  date_of_birth DATE,
  travel_date DATE,
  gender VARCHAR(20) DEFAULT '',
  marital_status VARCHAR(100) DEFAULT '',
  status VARCHAR(30) DEFAULT 'new',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Blog categories table
CREATE TABLE IF NOT EXISTS blog_categories (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) NOT NULL UNIQUE,
  description TEXT DEFAULT '',
  image_url TEXT DEFAULT '',
  sort_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default blog categories
INSERT INTO blog_categories (name, slug, description, sort_order) VALUES
('Adventure', 'adventure', 'Thrilling adventures and adrenaline-filled travel experiences', 1),
('International Holidays', 'international-holidays', 'Explore the best international travel destinations and holiday ideas', 2),
('Domestic Holidays', 'domestic-holidays', 'Discover amazing travel destinations within India', 3),
('Travel Tips', 'travel-tips', 'Useful tips and guides for smarter travel planning', 4),
('Honeymoon', 'honeymoon', 'Romantic getaways and honeymoon destination ideas', 5),
('Family Holidays', 'family-holidays', 'Fun-filled holiday ideas for the whole family', 6),
('Luxury Travel', 'luxury-travel', 'Premium and luxury travel experiences', 7),
('Food & Culture', 'food-culture', 'Culinary journeys and cultural travel experiences', 8)
ON CONFLICT (slug) DO NOTHING;

-- Blog posts table
CREATE TABLE IF NOT EXISTS blogs (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  slug VARCHAR(255) NOT NULL UNIQUE,
  excerpt TEXT DEFAULT '',
  content TEXT,
  cover_image TEXT DEFAULT '',
  gallery_images JSONB,
  author VARCHAR(255) DEFAULT '',
  tags JSONB,
  category_id INT,
  meta_title VARCHAR(255) DEFAULT '',
  meta_description TEXT DEFAULT '',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add category_id column if it doesn't exist
ALTER TABLE IF EXISTS blogs ADD COLUMN IF NOT EXISTS category_id INT;
ALTER TABLE IF EXISTS blog_categories ALTER COLUMN image_url TYPE TEXT;

-- Trips/Packages table
CREATE TABLE IF NOT EXISTS trips (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  image_url TEXT NOT NULL,
  price VARCHAR(50) NOT NULL,
  duration VARCHAR(100) DEFAULT '',
  days VARCHAR(100) DEFAULT '',
  location VARCHAR(255) DEFAULT '',
  category VARCHAR(100) DEFAULT 'general',
  badge VARCHAR(100) DEFAULT '',
  destination_id INT,
  is_trending BOOLEAN DEFAULT false,
  is_spiritual BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- About Us section
CREATE TABLE IF NOT EXISTS about_us (
  id SERIAL PRIMARY KEY,
  heading VARCHAR(255) DEFAULT 'Travel that Touches the Soul',
  subheading TEXT DEFAULT 'Curated Travel. Authentic Moments. Lasting Impact.',
  description TEXT DEFAULT 'At Trip For Soul, we craft meaningful land journeys that are soulful, sustainable, and deeply personal.',
  features TEXT,
  cta_text VARCHAR(255) DEFAULT 'Begin Your Journey',
  cta_link VARCHAR(255) DEFAULT '/enquire-now',
  image_url TEXT DEFAULT '',
  premium_heading VARCHAR(255) DEFAULT '',
  premium_description TEXT DEFAULT '',
  premium_button_text VARCHAR(255) DEFAULT '',
  premium_button_link VARCHAR(255) DEFAULT '',
  experience_heading VARCHAR(255) DEFAULT '',
  experience_description_title VARCHAR(255) DEFAULT '',
  experience_description TEXT DEFAULT '',
  experience_subheading VARCHAR(255) DEFAULT '',
  experience_list TEXT DEFAULT '',
  experience_image TEXT DEFAULT '',
  why_heading VARCHAR(255) DEFAULT '',
  why_description TEXT DEFAULT '',
  why_image TEXT DEFAULT '',
  promise_heading VARCHAR(255) DEFAULT '',
  promise_subheading VARCHAR(255) DEFAULT '',
  promise_description TEXT DEFAULT '',
  promise_list TEXT DEFAULT '',
  promise_image TEXT DEFAULT '',
  difference_heading VARCHAR(255) DEFAULT '',
  difference_description TEXT DEFAULT '',
  difference_subheading VARCHAR(255) DEFAULT '',
  difference_list TEXT DEFAULT '',
  difference_image TEXT DEFAULT '',
  cta_heading VARCHAR(255) DEFAULT '',
  cta_description TEXT DEFAULT '',
  cta_button_text VARCHAR(255) DEFAULT '',
  cta_button_link VARCHAR(255) DEFAULT '',
  is_active BOOLEAN DEFAULT true,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO about_us (heading, subheading, description) VALUES
('Travel that Touches the Soul', 'Curated Travel. Authentic Moments. Lasting Impact.', 'At Trip For Soul, we craft meaningful land journeys that are soulful, sustainable, and deeply personal.')
ON CONFLICT DO NOTHING;

-- Features section
CREATE TABLE IF NOT EXISTS features (
  id SERIAL PRIMARY KEY,
  icon VARCHAR(100) NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  sort_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO features (icon, title, description, sort_order) VALUES
('best-price', 'Best Price Guarantee', 'We ensure you get the most value for your journey with competitive pricing on every package.', 1),
('easy-booking', 'Easy & Quick Booking', 'Book your dream trips in minutes with our simple and hassle-free booking system.', 2),
('support', 'Customer Care 24/7', 'Our dedicated support team is available around the clock to ensure a seamless travel experience.', 3)
ON CONFLICT DO NOTHING;

-- Testimonials section
CREATE TABLE IF NOT EXISTS testimonials (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  image_url TEXT DEFAULT '',
  rating INT DEFAULT 5,
  review TEXT NOT NULL,
  video_url VARCHAR(500) DEFAULT '',
  influencer_video_url VARCHAR(500) DEFAULT '',
  sort_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO testimonials (name, image_url, rating, review, sort_order) VALUES
('Mr. Ritik Singh', 'https://tripforsoul.com/public/img/gallery/b-4.png', 5, 'We booked a 12-day tour of Italy with TripForSoul and had an absolutely remarkable experience. The itinerary was perfectly balanced — Florence, Rome, and Venice plus countryside in Tuscany. The hotels were very comfortable, the guides knowledgeable, and the logistics seamless. Highly recommend for anyone wanting to see the real Italy.', 1),
('Sohan Sharma', 'https://tripforsoul.com/public/img/gallery/b-1.png', 5, 'We booked Vietnam with TripForSoul. It was so much enchanting. From the moment we landed in Hanoi to the cruise in Ha Long Bay, everything was organised to perfection.', 2),
('Rakesh Singh', 'https://tripforsoul.com/public/img/gallery/b-2.png', 5, 'Europe package (Paris, Amsterdam, Barcelona) was a dream, with TripForSoul. Hotels: well-situated and clean. Tours: insightful. The small touchups (local restaurant recommendations, optional side-trips) made it feel bespoke rather than just a "standard package." Worth every penny.', 3),
('Vishnu Kumar', 'https://tripforsoul.com/public/img/gallery/b-3.png', 5, 'Our UK tour was absolutely unforgettable. From the busy streets of London to the serene landscapes of the Cotswolds, everything was organised flawlessly. The coach was clean and comfortable, accommodations exceeded expectations. Thanks tripforsoul. Highly recommend them for holidays.', 4)
ON CONFLICT DO NOTHING;

-- Admin-managed global settings (design, services, cookies, CRM handoff)
CREATE TABLE IF NOT EXISTS site_settings (
  id SERIAL PRIMARY KEY,
  setting_key VARCHAR(100) NOT NULL UNIQUE,
  setting_value JSONB NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Services table
CREATE TABLE IF NOT EXISTS services (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  slug VARCHAR(255) NOT NULL UNIQUE,
  description TEXT DEFAULT '',
  image_url TEXT DEFAULT '',
  icon VARCHAR(100) DEFAULT '',
  sort_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Destinations table
CREATE TABLE IF NOT EXISTS destinations (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) NOT NULL UNIQUE,
  description TEXT,
  image_url TEXT DEFAULT '',
  gallery_images JSONB,
  region VARCHAR(100) DEFAULT '',
  price VARCHAR(50) DEFAULT '',
  duration VARCHAR(100) DEFAULT '',
  highlights TEXT,
  is_trending BOOLEAN DEFAULT false,
  is_spiritual BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Packages table
CREATE TABLE IF NOT EXISTS packages (
  id SERIAL PRIMARY KEY,
  destination_id INT,
  title VARCHAR(255) NOT NULL,
  slug VARCHAR(255) NOT NULL UNIQUE,
  days VARCHAR(50) DEFAULT '',
  meals VARCHAR(255) DEFAULT '',
  short_description TEXT,
  long_description TEXT,
  sub_heading VARCHAR(255) DEFAULT '',
  image_url TEXT DEFAULT '',
  gallery_images JSONB,
  inclusives TEXT,
  exclusives TEXT,
  itinerary TEXT,
  additional_info TEXT,
  price VARCHAR(50) DEFAULT '',
  is_trending BOOLEAN DEFAULT false,
  is_spiritual BOOLEAN DEFAULT false,
  sort_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_packages_destination_id ON packages(destination_id);
CREATE INDEX IF NOT EXISTS idx_packages_sort_order ON packages(sort_order);

-- Page banners table
CREATE TABLE IF NOT EXISTS page_banners (
  id SERIAL PRIMARY KEY,
  page_key VARCHAR(100) NOT NULL UNIQUE,
  title VARCHAR(255) DEFAULT '',
  subtitle TEXT,
  heading VARCHAR(255) DEFAULT '',
  subheading TEXT DEFAULT '',
  background_image TEXT DEFAULT '',
  is_active BOOLEAN DEFAULT true,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Team members table
CREATE TABLE IF NOT EXISTS team_members (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  designation VARCHAR(255) NOT NULL,
  image_url TEXT DEFAULT '',
  bio TEXT,
  sort_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Gallery images table
CREATE TABLE IF NOT EXISTS gallery_images (
  id SERIAL PRIMARY KEY,
  image_url TEXT NOT NULL,
  video_url VARCHAR(500) DEFAULT '',
  media_type VARCHAR(20) DEFAULT 'image',
  title VARCHAR(255) DEFAULT '',
  caption VARCHAR(255) DEFAULT '',
  category VARCHAR(100) DEFAULT '',
  sort_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
