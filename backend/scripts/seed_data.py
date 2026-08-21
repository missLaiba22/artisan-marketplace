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
            ("Azure Bloom Vase", "3200", 10, "https://res.cloudinary.com/j9bjqwat/image/upload/v1784297470/Blue_Ceramic_Vase_thncs8.png",
             "Hand-thrown ceramic vase glazed in signature cobalt blue, finished with traditional floral motifs."),
            ("Sapphire Tea Cup Set", "2800", 12, "https://res.cloudinary.com/j9bjqwat/image/upload/v1784297481/blue_pottery_tea_cup_rlvufu.png",
             "Set of hand-painted blue pottery teacups, glazed and fired using traditional Multani techniques."),
            ("Heritage Wall Plate", "2500", 8, "https://res.cloudinary.com/j9bjqwat/image/upload/v1784297470/blue_pottery_decorative_plate_zzcyvr.png",
             "Decorative wall plate with intricate hand-painted blue floral patterns, ready to hang."),
            ("Mosaic Candle Holder", "1400", 15, "https://res.cloudinary.com/j9bjqwat/image/upload/v1784297442/blue_pottery_candle_holder_qo8wca.png",
             "Small ceramic candle holder with mosaic-style blue glazing, handmade in Multan."),
            ("Artisan Serving Bowl", "2100", 10, "https://res.cloudinary.com/j9bjqwat/image/upload/v1784297481/blue_pottery_serving_bowl_y3td6q.png",
             "Wide ceramic serving bowl glazed in classic blue pottery style, ideal for everyday dining."),
        ],
    },
    {
        "shop_name": "Sindh Threads Studio",
        "email": "sindhthreadsstudio@demo.com",
        "description": "Handmade embroidered home decor and textile products celebrating Sindhi craftsmanship.",
        "location": "Hyderabad, Sindh",
        "products": [
            ("Floral Embroidered Cushion Cover", "1600", 14, "https://res.cloudinary.com/j9bjqwat/image/upload/v1784297566/Embroidered_Cushion_Cover_ultjgp.png",
             "Cotton cushion cover hand-embroidered with floral thread work in traditional Sindhi style."),
            ("Classic Ajrak Table Runner", "2300", 10, "https://res.cloudinary.com/j9bjqwat/image/upload/v1784297636/handmade_Ajrak_table_runner_tavqyh.png",
             "Block-printed Ajrak table runner featuring classic geometric Sindhi patterns."),
            ("Heritage Embroidered Tote Bag", "2100", 9, "https://res.cloudinary.com/j9bjqwat/image/upload/v1784297635/handmade_embroidered_tote_bag_wadpmy.png",
             "Sturdy cotton tote bag with hand-embroidered panels, blending everyday use with heritage craft."),
            ("Sindhi Textile Wall Hanging", "3000", 6, "https://res.cloudinary.com/j9bjqwat/image/upload/v1784297620/handmade_embroidered_textile_wall_hanging_esri98.png",
             "Large embroidered wall hanging showcasing traditional Sindhi textile patterns and mirror work."),
            ("Handcrafted Dining Table Mat", "1200", 16, "https://res.cloudinary.com/j9bjqwat/image/upload/v1784297620/handcrafted_embroidered_fabric_table_mat_x63ja1.png",
             "Embroidered fabric table mat, hand-stitched with traditional Sindhi thread patterns."),
        ],
    },
    {
        "shop_name": "Chiniot Woodcrafts",
        "email": "chiniotwoodcrafts@demo.com",
        "description": "Hand-carved wooden home decor and accessories crafted by skilled artisans from Chiniot.",
        "location": "Chiniot, Punjab",
        "products": [
            ("Walnut Serving Tray", "3500", 7, "https://res.cloudinary.com/j9bjqwat/image/upload/v1784297709/Wooden_Serving_Tray_ywhsfw.png",
             "Hand-carved serving tray made from solid walnut wood, finished with traditional Chiniot woodwork detailing."),
            ("Carved Jewelry Box", "2700", 9, "https://res.cloudinary.com/j9bjqwat/image/upload/v1784297715/Wooden_Jewelry_Box_fgqcrp.png",
             "Wooden jewelry box with intricately hand-carved lid, made using traditional Chiniot carving techniques."),
            ("Heritage Wooden Desk Organizer", "1900", 11, "https://res.cloudinary.com/j9bjqwat/image/upload/v1784297716/Wooden_Pen_Holder_hoedzp.png",
             "Compact wooden desk organizer, hand-carved with heritage patterns typical of Chiniot craftsmanship."),
            ("Artisan Wall Shelf", "4500", 5, "https://res.cloudinary.com/j9bjqwat/image/upload/v1784297553/Decorative_Wall_Shelf_jminp4.png",
             "Solid wood wall shelf with hand-carved detailing, built to display decor pieces or books."),
            ("Floral Tissue Box Cover", "2200", 13, "https://res.cloudinary.com/j9bjqwat/image/upload/v1784297730/Wooden_Tissue_Box_ierwkb.png",
             "Wooden tissue box cover carved with floral motifs, a small heritage-craft accent for any table."),
        ],
    },
    {
        "shop_name": "Peshawar Leather Works",
        "email": "peshawarleatherworks@demo.com",
        "description": "Premium handcrafted leather accessories made using traditional techniques.",
        "location": "Peshawar, Khyber Pakhtunkhwa",
        "products": [
            ("Classic Leather Wallet", "2600", 12, "https://res.cloudinary.com/j9bjqwat/image/upload/v1784297716/Leather_Wallet_uzlhhl.png",
             "Genuine leather bifold wallet, hand-stitched and finished with traditional Peshawari tanning methods."),
            ("Heritage Passport Holder", "1900", 10, "https://res.cloudinary.com/j9bjqwat/image/upload/v1784297720/Passport_Holder_rhk4ww.png",
             "Slim leather passport holder, hand-cut and stitched for durability and everyday travel."),
            ("Artisan Leather Belt", "2300", 14, "https://res.cloudinary.com/j9bjqwat/image/upload/v1784297637/Leather_Belt_lvzfba.png",
             "Full-grain leather belt, hand-finished with a classic buckle and traditional edge stitching."),
            ("Vintage Messenger Bag", "8500", 4, "https://res.cloudinary.com/j9bjqwat/image/upload/v1784297690/Leather_Messenger_Bag_uiskab.png",
             "Spacious leather messenger bag with a vintage finish, hand-crafted for daily carry."),
            ("Minimal Leather Card Holder", "1400", 18, "https://res.cloudinary.com/j9bjqwat/image/upload/v1784297636/Leather_Card_Holder_qj1fnb.png",
             "Slim, minimal leather card holder, hand-stitched with a smooth traditional tan finish."),
        ],
    },
    {
        "shop_name": "Crochet Corner Pakistan",
        "email": "crochetcornerpakistan@demo.com",
        "description": "Handmade crochet gifts, home decor, and amigurumi crafted with love.",
        "location": "Lahore, Punjab",
        "products": [
            ("Cozy Teddy Bear", "2200", 9, "https://res.cloudinary.com/j9bjqwat/image/upload/v1784297546/Crochet_Teddy_Bear_nlo7it.png",
             "Soft handmade crochet teddy bear, perfect as a gift or nursery decor piece."),
            ("Sunflower Crochet Bouquet", "2000", 11, "https://res.cloudinary.com/j9bjqwat/image/upload/v1784297544/Crochet_SunFlower_Bouqet_ktsgkd.png",
             "Hand-crocheted sunflower bouquet that never wilts, a lasting handmade floral gift."),
            ("Handmade Crochet Tote Bag", "2800", 7, "https://res.cloudinary.com/j9bjqwat/image/upload/v1784297560/Crochet_Tote_Bag_b2duj2.png",
             "Durable crochet tote bag, hand-stitched with a chunky yarn pattern for everyday use."),
            ("Pastel Bunny Doll", "2400", 10, "https://res.cloudinary.com/j9bjqwat/image/upload/v1784297462/Crochet_Bunny_Doll_bwzdn3.png",
             "Handmade crochet bunny doll in soft pastel tones, a cozy gift for children."),
            ("Floral Crochet Coaster Set", "1300", 15, "https://res.cloudinary.com/j9bjqwat/image/upload/v1784297515/Crochet_Coaster_Set_zvzykc.png",
             "Set of hand-crocheted floral coasters, adding a handmade touch to any table setting."),
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

            for name, price, stock, image_url, description in shop["products"]:
                db.add(Product(
                    artisan_id=artisan.id,
                    name=name,
                    description=description,
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