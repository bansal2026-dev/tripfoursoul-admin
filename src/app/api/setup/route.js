import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function GET() {
  try {
    const results = {
      success: true,
      message: 'Setup completed',
      postgresUsed: false,
      errors: []
    };

    // Check if PostgreSQL is available
    try {
      results.postgresUsed = await db.isPostgresAvailable();
      if (!results.postgresUsed) {
        results.message = 'PostgreSQL not available. Using JSON fallback mode.';
        results.errors.push('PostgreSQL connection failed: DATABASE_URL not configured or unreachable');
      }
    } catch (e) {
      results.message = 'PostgreSQL not available. Using JSON fallback mode.';
      results.errors.push('PostgreSQL connection failed: ' + e.message);
    }

    // Only run DDL queries if PostgreSQL is available
    if (results.postgresUsed) {
      // Create admins table
      try {
        await db.query(`
          CREATE TABLE IF NOT EXISTS admins (
            id SERIAL PRIMARY KEY,
            username VARCHAR(100) NOT NULL UNIQUE,
            email VARCHAR(255) NOT NULL UNIQUE,
            password VARCHAR(255) NOT NULL,
            role VARCHAR(50) DEFAULT 'staff',
            permissions JSONB,
            is_active BOOLEAN DEFAULT true,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )
        `);
      } catch (e) {
        results.errors.push('Admins table: ' + e.message);
      }

      // Add missing columns if they don't exist
      try { await db.query(`ALTER TABLE admins ADD COLUMN IF NOT EXISTS role VARCHAR(50) DEFAULT 'staff'`); } catch (e) {}
      try { await db.query(`ALTER TABLE admins ADD COLUMN IF NOT EXISTS permissions JSONB`); } catch (e) {}
      try { await db.query(`ALTER TABLE admins ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true`); } catch (e) {}
      try { await db.query(`ALTER TABLE admins ADD COLUMN IF NOT EXISTS reset_token_hash VARCHAR(64)`); } catch (e) {}
      try { await db.query(`ALTER TABLE admins ADD COLUMN IF NOT EXISTS reset_token_expires_at TIMESTAMP`); } catch (e) {}

      // Insert or update default admin (password: admin123)
      try {
        await db.query(`
          INSERT INTO admins (username, email, password, role) VALUES
          ('admin', 'admin@tripforsoul.com', '$2a$10$8KzQMGx5C5Kc5Q5Q5Q5Q5u5Q5Q5Q5Q5Q5Q5Q5Q5Q5Q5Q5Q5Q5Q5Q', 'admin')
          ON CONFLICT (username) DO NOTHING
        `);
      } catch (e) {
        try { await db.query(`UPDATE admins SET role = 'admin' WHERE username = 'admin'`); } catch (e2) {}
      }

      // Create banner_settings table
      await db.query(`
        CREATE TABLE IF NOT EXISTS banner_settings (
          id SERIAL PRIMARY KEY,
          heading VARCHAR(255) DEFAULT 'Journeys Crafted for the Soul',
          subtitle TEXT,
          button1_text VARCHAR(100) DEFAULT 'Find Now',
          button2_text VARCHAR(100) DEFAULT 'View All Trips',
          button2_link VARCHAR(255) DEFAULT '/destinations',
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      await db.query(`
        INSERT INTO banner_settings (heading, subtitle)
        SELECT 'Journeys Crafted for the Soul', 'Not just another trip. We design meaningful land journeys that connect you with culture, people, and places beyond the tourist trail.'
        WHERE NOT EXISTS (SELECT 1 FROM banner_settings)
      `);

      // Create banner_images table
      await db.query(`
        CREATE TABLE IF NOT EXISTS banner_images (
          id SERIAL PRIMARY KEY,
          image_url TEXT NOT NULL,
          mobile_image_url TEXT DEFAULT '',
          sort_order INT DEFAULT 0,
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      try { await db.query(`ALTER TABLE banner_images ADD COLUMN IF NOT EXISTS mobile_image_url TEXT DEFAULT ''`); } catch (e) {}

      // Create trending_settings table
      await db.query(`
        CREATE TABLE IF NOT EXISTS trending_settings (
          id SERIAL PRIMARY KEY,
          is_enabled BOOLEAN DEFAULT true,
          heading VARCHAR(255) DEFAULT 'Trending Now',
          subtitle TEXT,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      await db.query(`
        INSERT INTO trending_settings (is_enabled, heading, subtitle)
        SELECT true, 'Trending Now', 'Most sought-after destinations this season'
        WHERE NOT EXISTS (SELECT 1 FROM trending_settings)
      `);

      // Create trending_items table
      await db.query(`
        CREATE TABLE IF NOT EXISTS trending_items (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          image_url TEXT NOT NULL,
          region VARCHAR(100) DEFAULT '',
          price VARCHAR(50) DEFAULT '',
          badge VARCHAR(100) DEFAULT '',
          sort_order INT DEFAULT 0,
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Create region_pricing table
      await db.query(`
        CREATE TABLE IF NOT EXISTS region_pricing (
          id SERIAL PRIMARY KEY,
          region VARCHAR(100) NOT NULL UNIQUE,
          starting_price VARCHAR(50) NOT NULL,
          currency VARCHAR(10) DEFAULT 'USD',
          usd_price VARCHAR(50) DEFAULT '',
          is_active BOOLEAN DEFAULT true,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      await db.query(`
        INSERT INTO region_pricing (region, starting_price, currency) VALUES
        ('Asia', '$799', 'USD'),
        ('Europe', '$1,499', 'USD'),
        ('Middle East', '$999', 'USD'),
        ('Africa', '$1,299', 'USD'),
        ('Americas', '$1,199', 'USD')
        ON CONFLICT (region) DO NOTHING
      `);

      // Create popular_destinations table
      await db.query(`
        CREATE TABLE IF NOT EXISTS popular_destinations (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          image_url TEXT NOT NULL,
          region VARCHAR(100) DEFAULT '',
          price VARCHAR(50) DEFAULT '',
          sort_order INT DEFAULT 0,
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Create homepage_sections table
      await db.query(`
        CREATE TABLE IF NOT EXISTS homepage_sections (
          id SERIAL PRIMARY KEY,
          section_key VARCHAR(100) NOT NULL UNIQUE,
          section_name VARCHAR(255) NOT NULL,
          is_visible BOOLEAN DEFAULT true,
          sort_order INT DEFAULT 0,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      await db.query(`
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
        ON CONFLICT (section_key) DO NOTHING
      `);

      // Create deals_settings table
      await db.query(`
        CREATE TABLE IF NOT EXISTS deals_settings (
          id SERIAL PRIMARY KEY,
          tagline VARCHAR(255) DEFAULT 'Travel offers',
          heading VARCHAR(255) DEFAULT 'Make more of every journey.',
          description TEXT,
          button_text VARCHAR(100) DEFAULT 'Ask about offers',
          button_link VARCHAR(255) DEFAULT '/contact?subject=Offer%20enquiry',
          card_tagline VARCHAR(255) DEFAULT 'Planning made personal',
          card_heading TEXT,
          card_description TEXT,
          is_active BOOLEAN DEFAULT true,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      await db.query(`
        INSERT INTO deals_settings (tagline, heading, description, button_text, button_link, card_tagline, card_heading, card_description, is_active)
        SELECT 'Travel offers', 'Make more of every journey.', 'Discover current seasonal offers and speak with our team to find the journey that suits your plans.', 'Ask about offers', '/contact?subject=Offer%20enquiry', 'Planning made personal', 'Get a tailored recommendation, clear inclusions, and expert support before you book.', 'Offer availability and final pricing are confirmed by the travel team.', true
        WHERE NOT EXISTS (SELECT 1 FROM deals_settings)
      `);

      await db.query(`
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
        )
      `);

      // Create trips table
      await db.query(`
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
        )
      `);

      try { await db.query(`CREATE INDEX IF NOT EXISTS idx_category ON trips(category)`); } catch (e) {}
      try { await db.query(`CREATE INDEX IF NOT EXISTS idx_is_active ON trips(is_active)`); } catch (e) {}

      // Create about_us table
      await db.query(`
        CREATE TABLE IF NOT EXISTS about_us (
          id SERIAL PRIMARY KEY,
          heading VARCHAR(255) DEFAULT 'Travel that Touches the Soul',
          subheading TEXT,
          description TEXT,
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
        )
      `);

      await db.query(`
        INSERT INTO about_us (heading, subheading, description) VALUES
        ('Travel that Touches the Soul', 'Curated Travel. Authentic Moments. Lasting Impact.', 'At Trip For Soul, we craft meaningful land journeys that are soulful, sustainable, and deeply personal.')
        ON CONFLICT DO NOTHING
      `);

      // Create features table
      await db.query(`
        CREATE TABLE IF NOT EXISTS features (
          id SERIAL PRIMARY KEY,
          icon VARCHAR(100) NOT NULL,
          title VARCHAR(255) NOT NULL,
          description TEXT NOT NULL,
          sort_order INT DEFAULT 0,
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      await db.query(`
        INSERT INTO features (icon, title, description, sort_order) VALUES
        ('best-price', 'Best Price Guarantee', 'We ensure you get the most value for your journey with competitive pricing on every package.', 1),
        ('easy-booking', 'Easy & Quick Booking', 'Book your dream trips in minutes with our simple and hassle-free booking system.', 2),
        ('support', 'Customer Care 24/7', 'Our dedicated support team is available around the clock to ensure a seamless travel experience.', 3)
        ON CONFLICT DO NOTHING
      `);

      // Create services table
      await db.query(`
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
        )
      `);

      // Create testimonials table
      await db.query(`
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
        )
      `);

      await db.query(`
        INSERT INTO testimonials (name, image_url, rating, review, sort_order) VALUES
        ('Mr. Ritik Singh', 'https://tripforsoul.com/public/img/gallery/b-4.png', 5, 'We booked a 12-day tour of Italy with TripForSoul and had an absolutely remarkable experience. The itinerary was perfectly balanced — Florence, Rome, and Venice plus countryside in Tuscany. The hotels were very comfortable, the guides knowledgeable, and the logistics seamless. Highly recommend for anyone wanting to see the real Italy.', 1),
        ('Sohan Sharma', 'https://tripforsoul.com/public/img/gallery/b-1.png', 5, 'We booked Vietnam with TripForSoul. It was so much enchanting. From the moment we landed in Hanoi to the cruise in Ha Long Bay, everything was organised to perfection.', 2),
        ('Rakesh Singh', 'https://tripforsoul.com/public/img/gallery/b-2.png', 5, 'Europe package (Paris, Amsterdam, Barcelona) was a dream, with TripForSoul. Hotels: well-situated and clean. Tours: insightful. The small touch-ups (local restaurant recommendations, optional side-trips) made it feel bespoke rather than just a "standard package." Worth every penny.', 3),
        ('Vishnu Kumar', 'https://tripforsoul.com/public/img/gallery/b-3.png', 5, 'Our UK tour was absolutely unforgettable. From the busy streets of London to the serene landscapes of the Cotswolds, everything was organised flawlessly. The coach was clean and comfortable, accommodations exceeded expectations. Thanks tripforsoul. Highly recommend them for holidays.', 4)
        ON CONFLICT DO NOTHING
      `);

      // Create destinations table
      await db.query(`
        CREATE TABLE IF NOT EXISTS destinations (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          slug VARCHAR(255) NOT NULL UNIQUE,
          description TEXT,
          image_url TEXT DEFAULT '',
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
        )
      `);

      // Create packages table
      await db.query(`
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
        )
      `);
      try { await db.query('ALTER TABLE packages ADD COLUMN IF NOT EXISTS gallery_images JSONB'); } catch (e) {}

      // Create page_banners table
      await db.query(`
        CREATE TABLE IF NOT EXISTS page_banners (
          id SERIAL PRIMARY KEY,
          page_key VARCHAR(100) NOT NULL UNIQUE,
          title VARCHAR(255) DEFAULT '',
          subtitle TEXT,
          background_image TEXT DEFAULT '',
          is_active BOOLEAN DEFAULT true,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Create team_members table
      await db.query(`
        CREATE TABLE IF NOT EXISTS team_members (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          designation VARCHAR(255) NOT NULL,
          image_url TEXT DEFAULT '',
          bio TEXT,
          sort_order INT DEFAULT 0,
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Create gallery_images table
      await db.query(`
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
        )
      `);

      // Create blog_categories table
      await db.query(`
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
        )
      `);

      // Insert default blog categories
      await db.query(`
        INSERT INTO blog_categories (name, slug, description, sort_order) VALUES
        ('Adventure', 'adventure', 'Thrilling adventures and adrenaline-filled travel experiences', 1),
        ('International Holidays', 'international-holidays', 'Explore the best international travel destinations and holiday ideas', 2),
        ('Domestic Holidays', 'domestic-holidays', 'Discover amazing travel destinations within India', 3),
        ('Travel Tips', 'travel-tips', 'Useful tips and guides for smarter travel planning', 4),
        ('Honeymoon', 'honeymoon', 'Romantic getaways and honeymoon destination ideas', 5),
        ('Family Holidays', 'family-holidays', 'Fun-filled holiday ideas for the whole family', 6),
        ('Luxury Travel', 'luxury-travel', 'Premium and luxury travel experiences', 7),
        ('Food & Culture', 'food-culture', 'Culinary journeys and cultural travel experiences', 8)
        ON CONFLICT (slug) DO NOTHING
      `);

      // Create blogs table
      await db.query(`
        CREATE TABLE IF NOT EXISTS blogs (
          id SERIAL PRIMARY KEY,
          title VARCHAR(255) NOT NULL,
          slug VARCHAR(255) NOT NULL UNIQUE,
          excerpt TEXT,
          content TEXT,
          cover_image TEXT DEFAULT '',
          gallery_images JSONB,
          author VARCHAR(255) DEFAULT '',
          tags JSONB,
          category_id INT,
          meta_title VARCHAR(255) DEFAULT '',
          meta_description TEXT,
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Add category_id column to blogs if it doesn't exist
      try { await db.query(`ALTER TABLE blogs ADD COLUMN IF NOT EXISTS category_id INT`); } catch (e) {}
      try { await db.query(`ALTER TABLE blog_categories ALTER COLUMN image_url TYPE TEXT`); } catch (e) {}

      await db.query(`
        CREATE TABLE IF NOT EXISTS site_settings (
          id SERIAL PRIMARY KEY,
          setting_key VARCHAR(100) NOT NULL UNIQUE,
          setting_value JSONB NOT NULL,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Convert image columns to TEXT type to support base64 data URLs
      // Base64 images can be hundreds of KB/MB, VARCHAR(500) is too small
      const alterImageColumns = [
        ['banner_images', 'image_url'],
        ['trending_items', 'image_url'],
        ['popular_destinations', 'image_url'],
        ['trips', 'image_url'],
        ['destinations', 'image_url'],
        ['packages', 'image_url'],
        ['testimonials', 'image_url'],
        ['about_us', 'image_url'],
        ['about_us', 'experience_image'],
        ['about_us', 'why_image'],
        ['about_us', 'promise_image'],
        ['about_us', 'difference_image'],
        ['page_banners', 'background_image'],
        ['team_members', 'image_url'],
        ['gallery_images', 'image_url'],
        ['blogs', 'cover_image'],
        ['services', 'image_url'],
        ['offers', 'image_url'],
      ];

      for (const [table, column] of alterImageColumns) {
        try {
          await db.query(`ALTER TABLE ${table} ALTER COLUMN ${column} TYPE TEXT`);
        } catch (e) {
          // Column might not exist yet - skip silently
        }
      }

      // Add page_banners heading/subheading columns
      // Legacy schema used title/subtitle, API and frontend use heading/subheading
      try { await db.query(`ALTER TABLE page_banners ADD COLUMN IF NOT EXISTS heading VARCHAR(255) DEFAULT ''`); } catch (e) {}
      try { await db.query(`ALTER TABLE page_banners ADD COLUMN IF NOT EXISTS subheading TEXT DEFAULT ''`); } catch (e) {}
      // Migrate data from legacy title/subtitle columns to heading/subheading
      try { await db.query(`UPDATE page_banners SET heading = title WHERE (heading = '' OR heading IS NULL) AND title IS NOT NULL AND title != ''`); } catch (e) {}
      try { await db.query(`UPDATE page_banners SET subheading = subtitle WHERE (subheading = '' OR subheading IS NULL) AND subtitle IS NOT NULL`); } catch (e) {}

      // Add missing columns to existing tables (for migrations from older schemas)
      const alterColumns = [
        ['destinations', 'is_trending', 'BOOLEAN DEFAULT false'],
        ['destinations', 'is_spiritual', 'BOOLEAN DEFAULT false'],
        ['trips', 'is_trending', 'BOOLEAN DEFAULT false'],
        ['trips', 'is_spiritual', 'BOOLEAN DEFAULT false'],
        ['packages', 'is_trending', 'BOOLEAN DEFAULT false'],
        ['packages', 'is_spiritual', 'BOOLEAN DEFAULT false'],
        ['packages', 'price_usd', "VARCHAR(50) DEFAULT ''"],
        ['packages', 'price_inr', "VARCHAR(50) DEFAULT ''"],
        ['packages', 'price_eur', "VARCHAR(50) DEFAULT ''"],
        ['destinations', 'price_usd', "VARCHAR(50) DEFAULT ''"],
        ['destinations', 'price_inr', "VARCHAR(50) DEFAULT ''"],
        ['destinations', 'price_eur', "VARCHAR(50) DEFAULT ''"],
        ['destinations', 'gallery_images', 'JSONB'],
        ['trips', 'days', 'VARCHAR(100) DEFAULT \'\''],
        ['trips', 'destination_id', 'INT'],
        ['offers', 'coupon_code', "VARCHAR(100) DEFAULT ''"],
        ['offers', 'travel_start_date', 'DATE'],
        ['offers', 'travel_end_date', 'DATE'],
        ['offers', 'duration_days', 'INTEGER'],
        ['offers', 'duration', 'TEXT'],
        ['leads', 'offer_duration', 'TEXT'],
        ['leads', 'offer_duration_days', 'INTEGER'],
        ['leads', 'service_type', "VARCHAR(100) DEFAULT ''"],
        ['leads', 'source_page', "VARCHAR(500) DEFAULT ''"],
        ['leads', 'middle_name', "VARCHAR(255) DEFAULT ''"],
        ['leads', 'nationality', "VARCHAR(255) DEFAULT ''"],
        ['leads', 'travel_intent', "VARCHAR(255) DEFAULT ''"],
        ['leads', 'financial_sponsorship_info', "TEXT DEFAULT ''"],
        ['leads', 'date_of_birth', 'DATE'],
        ['leads', 'travel_date', 'DATE'],
        ['leads', 'gender', "VARCHAR(20) DEFAULT ''"],
        ['leads', 'marital_status', "VARCHAR(100) DEFAULT ''"],
        ['packages', 'itinerary', 'TEXT'],
        ['packages', 'additional_info', 'TEXT'],
        ['region_pricing', 'usd_price', 'VARCHAR(50) DEFAULT \'\''],
        ['about_us', 'premium_heading', 'VARCHAR(255) DEFAULT \'\''],
        ['about_us', 'premium_description', 'TEXT DEFAULT \'\''],
        ['about_us', 'premium_button_text', 'VARCHAR(255) DEFAULT \'\''],
        ['about_us', 'premium_button_link', 'VARCHAR(255) DEFAULT \'\''],
        ['about_us', 'experience_heading', 'VARCHAR(255) DEFAULT \'\''],
        ['about_us', 'experience_description_title', 'VARCHAR(255) DEFAULT \'\''],
        ['about_us', 'experience_description', 'TEXT DEFAULT \'\''],
        ['about_us', 'experience_subheading', 'VARCHAR(255) DEFAULT \'\''],
        ['about_us', 'experience_list', 'TEXT DEFAULT \'\''],
        ['about_us', 'experience_image', 'TEXT DEFAULT \'\''],
        ['about_us', 'why_heading', 'VARCHAR(255) DEFAULT \'\''],
        ['about_us', 'why_description', 'TEXT DEFAULT \'\''],
        ['about_us', 'why_image', 'TEXT DEFAULT \'\''],
        ['about_us', 'promise_heading', 'VARCHAR(255) DEFAULT \'\''],
        ['about_us', 'promise_subheading', 'VARCHAR(255) DEFAULT \'\''],
        ['about_us', 'promise_description', 'TEXT DEFAULT \'\''],
        ['about_us', 'promise_list', 'TEXT DEFAULT \'\''],
        ['about_us', 'promise_image', 'TEXT DEFAULT \'\''],
        ['about_us', 'difference_heading', 'VARCHAR(255) DEFAULT \'\''],
        ['about_us', 'difference_description', 'TEXT DEFAULT \'\''],
        ['about_us', 'difference_subheading', 'VARCHAR(255) DEFAULT \'\''],
        ['about_us', 'difference_list', 'TEXT DEFAULT \'\''],
        ['about_us', 'difference_image', 'TEXT DEFAULT \'\''],
        ['about_us', 'cta_heading', 'VARCHAR(255) DEFAULT \'\''],
        ['about_us', 'cta_description', 'TEXT DEFAULT \'\''],
        ['about_us', 'cta_button_text', 'VARCHAR(255) DEFAULT \'\''],
        ['about_us', 'cta_button_link', 'VARCHAR(255) DEFAULT \'\''],
      ];

      for (const [table, column, definition] of alterColumns) {
        try {
          await db.query(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS ${column} ${definition}`);
        } catch (e) {
          // Column might already exist or table doesn't exist yet
        }
      }

      // These tables are singletons. Keep the most recently updated row and
      // remove legacy duplicates created by older seed/setup runs.
      for (const table of ['banner_settings', 'trending_settings', 'deals_settings']) {
        const rows = await db.query(`SELECT id FROM ${table} ORDER BY updated_at DESC NULLS LAST, id DESC`);
        if (rows.length > 1) {
          await db.query(`DELETE FROM ${table} WHERE id <> $1`, [rows[0].id]);
        }
      }
    } // end if postgresUsed

    return NextResponse.json({
      success: true,
      message: results.message,
      postgresUsed: results.postgresUsed,
      errors: results.errors
    });
  } catch (error) {
    console.error('Setup error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
