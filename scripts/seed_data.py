"""
One-time seed script — populates 5 demo artisan shops with 5 products each.

Run directly with:  python scripts/seed_data.py
(Run from the backend project root, with your venv active — same as any other script.)

Design note: this goes straight through SQLAlchemy models, bypassing the
API/service layer entirely. That's deliberate — this is bulk demo-data
setup, not a test of registration/validation logic, so skipping the HTTP
round-trips is the right call here (see chat notes on the trade-off).

Idempotent: re-running this script skips any shop whose owner email
already exists, so it's safe to run more than once without duplicating data.
"""
import os
import sys
from decimal import Decimal

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.core.database import SessionLocal
from app.core.security import hash_password
from app.modules.auth.models import User, UserRole
from app.modules.artisans.models import Artisan
from app.modules.products.models import Product

DEMO_PASSWORD = "Demo1234!"  # same for all seed artisans — never do this outside seed data

SHOPS = [
    {
        "shop_name": "Multan Blue Pottery",
        "email": "multanbluepottery@demo.com",
        "description": "Traditional handcrafted blue pottery from Multan, inspired by centuries-old Pakistani ceramic artistry.",
        "location": "Multan, Punjab",
        "products": [
            ("Azure Bloom Vase", "3200", 10, "https://res.cloudinary.com/j9bjqwat/image/upload/v1784297470/Blue_Ceramic_Vase_thncs8.png"),
            ("Sapphire Tea Cup Set", "2800", 12, "https://res.cloudinary.com/j9bjqwat/image/upload/v1784297481/blue_pottery_tea_cup_rlvufu.png"),
            ("Heritage Wall Plate", "2500", 8, "https://res.cloudinary.com/j9bjqwat/image/upload/v1784297470/blue_pottery_decorative_plate_zzcyvr.png"),
            ("Mosaic Candle Holder", "1400", 15, "https://res.cloudinary.com/j9bjqwat/image/upload/v1784297442/blue_pottery_candle_holder_qo8wca.png"),
            ("Artisan Serving Bowl", "2100", 10, "https://res.cloudinary.com/j9bjqwat/image/upload/v1784297481/blue_pottery_serving_bowl_y3td6q.png"),
        ],
    },
    {
        "shop_name": "Sindh Threads Studio",
        "email": "sindhthreadsstudio@demo.com",
        "description": "Handmade embroidered home decor and textile products celebrating Sindhi craftsmanship.",
        "location": "Hyderabad, Sindh",
        "products": [
            ("Floral Embroidered Cushion Cover", "1600", 14, "https://res.cloudinary.com/j9bjqwat/image/upload/v1784297566/Embroidered_Cushion_Cover_ultjgp.png"),
            ("Classic Ajrak Table Runner", "2300", 10, "https://res.cloudinary.com/j9bjqwat/image/upload/v1784297636/handmade_Ajrak_table_runner_tavqyh.png"),
            ("Heritage Embroidered Tote Bag", "2100", 9, "https://res.cloudinary.com/j9bjqwat/image/upload/v1784297635/handmade_embroidered_tote_bag_wadpmy.png"),
            ("Sindhi Textile Wall Hanging", "3000", 6, "https://res.cloudinary.com/j9bjqwat/image/upload/v1784297620/handmade_embroidered_textile_wall_hanging_esri98.png"),
            ("Handcrafted Dining Table Mat", "1200", 16, "https://res.cloudinary.com/j9bjqwat/image/upload/v1784297620/handcrafted_embroidered_fabric_table_mat_x63ja1.png"),
        ],
    },
    {
        "shop_name": "Chiniot Woodcrafts",
        "email": "chiniotwoodcrafts@demo.com",
        "description": "Hand-carved wooden home decor and accessories crafted by skilled artisans from Chiniot.",
        "location": "Chiniot, Punjab",
        "products": [
            ("Walnut Serving Tray", "3500", 7, "https://res.cloudinary.com/j9bjqwat/image/upload/v1784297709/Wooden_Serving_Tray_ywhsfw.png"),
            ("Carved Jewelry Box", "2700", 9, "https://res.cloudinary.com/j9bjqwat/image/upload/v1784297715/Wooden_Jewelry_Box_fgqcrp.png"),
            ("Heritage Wooden Desk Organizer", "1900", 11, "https://res.cloudinary.com/j9bjqwat/image/upload/v1784297716/Wooden_Pen_Holder_hoedzp.png"),
            ("Artisan Wall Shelf", "4500", 5, "https://res.cloudinary.com/j9bjqwat/image/upload/v1784297553/Decorative_Wall_Shelf_jminp4.png"),
            ("Floral Tissue Box Cover", "2200", 13, "https://res.cloudinary.com/j9bjqwat/image/upload/v1784297730/Wooden_Tissue_Box_ierwkb.png"),
        ],
    },
    {
        "shop_name": "Peshawar Leather Works",
        "email": "peshawarleatherworks@demo.com",
        "description": "Premium handcrafted leather accessories made using traditional techniques.",
        "location": "Peshawar, Khyber Pakhtunkhwa",
        "products": [
            ("Classic Leather Wallet", "2600", 12, "https://res.cloudinary.com/j9bjqwat/image/upload/v1784297716/Leather_Wallet_uzlhhl.png"),
            ("Heritage Passport Holder", "1900", 10, "https://res.cloudinary.com/j9bjqwat/image/upload/v1784297720/Passport_Holder_rhk4ww.png"),
            ("Artisan Leather Belt", "2300", 14, "https://res.cloudinary.com/j9bjqwat/image/upload/v1784297637/Leather_Belt_lvzfba.png"),
            ("Vintage Messenger Bag", "8500", 4, "https://res.cloudinary.com/j9bjqwat/image/upload/v1784297690/Leather_Messenger_Bag_uiskab.png"),
            ("Minimal Leather Card Holder", "1400", 18, "https://res.cloudinary.com/j9bjqwat/image/upload/v1784297636/Leather_Card_Holder_qj1fnb.png"),
        ],
    },
    {
        "shop_name": "Crochet Corner Pakistan",
        "email": "crochetcornerpakistan@demo.com",
        "description": "Handmade crochet gifts, home decor, and amigurumi crafted with love.",
        "location": "Lahore, Punjab",
        "products": [
            ("Cozy Teddy Bear", "2200", 9, "https://res.cloudinary.com/j9bjqwat/image/upload/v1784297546/Crochet_Teddy_Bear_nlo7it.png"),
            ("Sunflower Crochet Bouquet", "2000", 11, "https://res.cloudinary.com/j9bjqwat/image/upload/v1784297544/Crochet_SunFlower_Bouqet_ktsgkd.png"),
            ("Handmade Crochet Tote Bag", "2800", 7, "https://res.cloudinary.com/j9bjqwat/image/upload/v1784297560/Crochet_Tote_Bag_b2duj2.png"),
            ("Pastel Bunny Doll", "2400", 10, "https://res.cloudinary.com/j9bjqwat/image/upload/v1784297462/Crochet_Bunny_Doll_bwzdn3.png"),
            ("Floral Crochet Coaster Set", "1300", 15, "https://res.cloudinary.com/j9bjqwat/image/upload/v1784297515/Crochet_Coaster_Set_zvzykc.png"),
        ],
    },
]


def seed():
    db = SessionLocal()
    created_shops = 0
    try:
        for shop in SHOPS:
            existing = db.query(User).filter(User.email == shop["email"]).first()
            if existing:
                print(f"Skipping '{shop['shop_name']}' — {shop['email']} already exists")
                continue

            user = User(
                email=shop["email"],
                password_hash=hash_password(DEMO_PASSWORD),
                name=shop["shop_name"],
                role=UserRole.ARTISAN,
            )
            db.add(user)
            db.flush()  # need user.id before creating the Artisan row

            artisan = Artisan(
                user_id=user.id,
                shop_name=shop["shop_name"],
                description=shop["description"],
                location=shop["location"],
                is_approved=True,  # seed data — skip the manual approval step
            )
            db.add(artisan)
            db.flush()  # need artisan.id before creating Product rows

            for name, price, stock, image_url in shop["products"]:
                db.add(Product(
                    artisan_id=artisan.id,
                    name=name,
                    description=None,
                    price=Decimal(price),
                    stock_quantity=stock,
                    image_url=image_url,
                ))

            created_shops += 1
            print(f"Prepared '{shop['shop_name']}' with {len(shop['products'])} products")

        db.commit()  # single commit — all shops succeed together or nothing persists
        print(f"\nDone. {created_shops} shop(s) created.")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed()