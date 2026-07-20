import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import * as artisansApi from "../api/artisans";
import * as productsApi from "../api/products";
import { getImageFallbackDataUri } from "../utils/imageFallback";

// --- Static content -------------------------------------------------------
// This array is a placeholder until the backend supports it for real:
//   - ARTISAN_STORIES needs a public "list approved artisans" endpoint
//     (only /artisans/pending exists today, and it's admin-gated).
// Content below mirrors the real seed data so it isn't just filler.

const ARTISAN_STORIES = [
  {
    shop: "Multan Blue Pottery",
    region: "Multan, Punjab",
    quote: "Every glaze is mixed by hand, the same way my grandfather taught me — no two pieces ever share the exact same blue.",
  },
  {
    shop: "Sindh Threads Studio",
    region: "Hyderabad, Sindh",
    quote: "Each stitch of Ajrak carries a pattern older than any of us — I'm just the one holding the needle today.",
  },
  {
    shop: "Chiniot Woodcrafts",
    region: "Chiniot, Punjab",
    quote: "Walnut wood teaches patience. You can't rush a carving — you can only listen to the grain.",
  },
  {
    shop: "Peshawar Leather Works",
    region: "Peshawar, Khyber Pakhtunkhwa",
    quote: "Good leather ages with you. I make pieces meant to outlast the person who buys them.",
  },
  {
    shop: "Crochet Corner Pakistan",
    region: "Lahore, Punjab",
    quote: "I learned to crochet from my mother during power outages. Now it's how I built my own income.",
  },
];

const TESTIMONIALS = [
  { quote: "The tea cup set arrived wrapped like a gift, with a note from the artisan herself. It didn't feel like online shopping.", name: "Ayesha R.", city: "Lahore" },
  { quote: "I bought the wooden jewelry box for my mother. She keeps telling everyone who made it and where it's from.", name: "Bilal K.", city: "Islamabad" },
  { quote: "Knowing exactly which shop and which city my order came from made the whole purchase feel personal.", name: "Sana M.", city: "Karachi" },
];

const FOOTER_SECTIONS = [
  {
    title: "Shop",
    links: [
      { label: "All Products", to: "/shop" },
      { label: "Pottery", to: "/shop" },
      { label: "Textiles", to: "/shop" },
    ],
  },
  {
    title: "Karigar",
    links: [
      { label: "Our Artisans", href: "/#stories" },
      { label: "Become a Seller", to: "/register" },
    ],
  },
  {
    title: "Support",
    links: [
      { label: "Shipping", to: "/shop" },
      { label: "Contact", to: "/login" },
    ],
  },
];

// --- Small presentational pieces ------------------------------------------

function SectionHead({ eyebrow, title, subtitle, light }) {
  return (
    <div className="text-center max-w-xl mx-auto mb-14">
      <p className={`font-mono text-[11px] tracking-widest uppercase ${light ? "text-brass-soft" : "text-brass"}`}>
        {eyebrow}
      </p>
      <h2 className={`font-display text-3xl mt-3 ${light ? "text-white" : "text-ink"}`}>{title}</h2>
      {subtitle && <p className="text-ink-soft text-sm mt-3 leading-relaxed">{subtitle}</p>}
    </div>
  );
}

function WhyIcon({ path }) {
  return (
    <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#F9F6F0" strokeWidth="1.4" className="mx-auto mb-4">
      {path}
    </svg>
  );
}

// --- Page -------------------------------------------------------------------

export default function Home() {
  const [products, setProducts] = useState([]);
  const [artisanLinks, setArtisanLinks] = useState({});
  const [status, setStatus] = useState("loading");

  useEffect(() => {
    artisansApi
      .listApprovedArtisans()
      .then((artisans) => {
        const linksByName = artisans.reduce((accumulator, artisan) => {
          accumulator[artisan.shop_name] = artisan.id;
          return accumulator;
        }, {});
        setArtisanLinks(linksByName);
      })
      .catch(() => setArtisanLinks({}));

    // "Handpicked Collection" = most recent 8, per product decision.
    // list_products already orders by insertion; no backend change needed.
    productsApi
      .listProducts({ limit: 8 })
      .then((data) => {
        setProducts(data);
        setStatus("ready");
      })
      .catch(() => setStatus("error"));
  }, []);

  return (
    <div>
      {/* 1. HERO */}
      <header className="bg-linear-to-br from-maroon to-[#3E0F1A] text-white text-center px-6 py-28">
        <p className="font-mono text-[11px] tracking-widest uppercase text-brass-soft mb-5">
          A digital gallery of Pakistani craftsmanship
        </p>
        <h1 className="font-display text-5xl sm:text-6xl leading-tight max-w-3xl mx-auto mb-6">
          Every Handmade Piece Carries a Story
        </h1>
        <p className="text-white/80 max-w-md mx-auto mb-10 leading-relaxed">
          Discover pottery, textiles, and heirlooms made by hand by independent
          artisans across Pakistan.
        </p>
        <div className="flex items-center justify-center gap-4">
          <a
            href="/shop"
            className="bg-white text-maroon font-mono text-xs uppercase tracking-wide px-8 py-4 rounded-sm hover:bg-brass-soft active:bg-crimson active:text-white transition-colors"
          >
            Explore the Collection
          </a>
          <a
            href="#stories"
            className="border border-white/60 text-white font-mono text-xs uppercase tracking-wide px-8 py-4 rounded-sm hover:bg-white/10 active:bg-crimson active:border-crimson transition-colors"
          >
            Meet Our Artisans
          </a>
        </div>
      </header>

      {/* 2. EXPLORE BY CRAFT — removed for now.
          With only 5 shops and one craft each, this pointed to the exact
          same destinations as "Visit Shop" below — pure redundancy, not a
          real second browsing mode. Re-add once Product has a real
          `category` field and multiple artisans can share a craft; the
          CRAFTS array + circular-image markup is preserved in git history
          from this commit, trivial to restore. */}

      {/* 3. STORIES BEHIND THE CRAFT */}
      <section id="stories" className="bg-white px-6 py-24">
        <SectionHead
          eyebrow="Meet the makers"
          title="Stories Behind the Craft"
        />
        <div className="max-w-4xl mx-auto space-y-20">
          {ARTISAN_STORIES.map((artisan, i) => (
            <div
              key={artisan.shop}
              className={`grid sm:grid-cols-2 gap-12 items-center ${i % 2 === 1 ? "sm:[direction:rtl]" : ""}`}
            >
              <div
                className={`aspect-4/3 rounded-sm bg-linear-to-br from-parchment-dark to-parchment flex items-center justify-center font-mono text-xs uppercase tracking-wide text-ink-soft ${i % 2 === 1 ? "sm:[direction:ltr]" : ""}`}
              >
                Artisan photo — {artisan.region.split(",")[0]}
              </div>
              <div className={i % 2 === 1 ? "sm:[direction:ltr]" : ""}>
                <p className="font-mono text-[11px] uppercase tracking-wide text-ink-soft mb-3">
                  {artisan.region}
                </p>
                <h3 className="font-display text-2xl mb-4">{artisan.shop}</h3>
                <p className="font-display italic text-ink-soft leading-relaxed mb-6">
                  "{artisan.quote}"
                </p>
                <Link
                  to={artisanLinks[artisan.shop] ? `/shops/${artisanLinks[artisan.shop]}` : "/shop"}
                  className="inline-block border border-maroon text-maroon font-mono text-xs uppercase tracking-wide px-6 py-2.5 rounded-sm hover:bg-maroon hover:text-white active:bg-crimson active:border-crimson transition-colors"
                >
                  Visit Shop
                </Link>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 4. HANDPICKED COLLECTION */}
      <section id="collection" className="px-6 py-24">
        <SectionHead
          eyebrow="Curated"
          title="Handpicked Collection"
          subtitle="A small, rotating selection of what's newest — not an algorithmic ranking."
        />

        {status === "loading" && (
          <p className="text-center font-mono text-sm text-ink-soft">Loading…</p>
        )}
        {status === "error" && (
          <p className="text-center text-clay text-sm">Couldn't load the collection.</p>
        )}

        {status === "ready" && (
          <div className="max-w-5xl mx-auto grid grid-cols-2 sm:grid-cols-4 gap-8">
            {products.map((p) => (
              <Link key={p.id} to={`/products/${p.id}`} className="block bg-white">
                <div className="hang-tag">
                  <img
                    src={p.image_url}
                    alt={p.name}
                    className="w-full aspect-square object-cover"
                    onError={(e) => {
                      e.currentTarget.src = getImageFallbackDataUri({ width: 400, height: 400, fill: "#EFE6D8" });
                    }}
                  />
                </div>
                <div className="pt-4">
                  <h4 className="font-display text-base leading-snug">{p.name}</h4>
                  <span className="font-mono text-brass text-sm">${Number(p.price).toFixed(2)}</span>
                </div>
              </Link>
            ))}
          </div>
        )}

        <div className="text-center mt-14">
          <Link
            to="/shop"
            className="inline-block border border-maroon text-maroon font-mono text-xs uppercase tracking-wide px-8 py-3 rounded-sm hover:bg-maroon hover:text-white active:bg-crimson active:border-crimson transition-colors"
          >
            View Full Collection
          </Link>
        </div>
      </section>

      {/* 5. WHY KARIGAR */}
      <section className="bg-maroon px-6 py-24">
        <SectionHead eyebrow="Our promise" title="Why Karigar" light />
        <div className="max-w-4xl mx-auto grid grid-cols-2 sm:grid-cols-4 gap-10 text-center">
          <div>
            <WhyIcon path={<path d="M7 11V6a2 2 0 1 1 4 0v5M11 10V4a2 2 0 1 1 4 0v6M15 10.5V6a2 2 0 1 1 4 0v9c0 3.3-2.7 6-6 6h-2c-2 0-3-.6-4.3-2L3 15.5c-.6-.7-.5-1.7.2-2.3.6-.5 1.5-.5 2.1.1L7 15" />} />
            <h4 className="font-display text-white text-lg mb-2">Direct from Artisans</h4>
            <p className="text-white/70 text-xs leading-relaxed">No middlemen — every purchase goes straight to the maker.</p>
          </div>
          <div>
            <WhyIcon path={<path d="M12 2 3 6v6c0 5 4 8.5 9 10 5-1.5 9-5 9-10V6z" />} />
            <h4 className="font-display text-white text-lg mb-2">Authentic Craftsmanship</h4>
            <p className="text-white/70 text-xs leading-relaxed">Verified artisan shops, each approved before they can sell.</p>
          </div>
          <div>
            <WhyIcon path={<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 1 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z" />} />
            <h4 className="font-display text-white text-lg mb-2">Fair Trade Pricing</h4>
            <p className="text-white/70 text-xs leading-relaxed">Artisans set their own prices — fair value for real skill.</p>
          </div>
          <div>
            <WhyIcon path={<path d="M12 2 2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />} />
            <h4 className="font-display text-white text-lg mb-2">Nationwide Delivery</h4>
            <p className="text-white/70 text-xs leading-relaxed">From Multan to Karachi — carefully packed, reliably shipped.</p>
          </div>
        </div>
      </section>

      {/* 6. CUSTOMER STORIES */}
      <section className="px-6 py-24">
        <SectionHead eyebrow="In their words" title="Customer Stories" />
        <div className="max-w-4xl mx-auto grid sm:grid-cols-3 gap-8">
          {TESTIMONIALS.map((t) => (
            <div key={t.name} className="bg-white border border-parchment-dark p-8">
              <p className="font-display italic text-ink leading-relaxed mb-6">"{t.quote}"</p>
              <p className="font-mono text-xs uppercase tracking-wide text-ink-soft">
                {t.name} — {t.city}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* 7. FOOTER */}
      <footer className="bg-maroon text-white/80 px-6 pt-16 pb-10">
        <div className="max-w-5xl mx-auto grid sm:grid-cols-4 gap-10 mb-12">
          <div>
            <p className="font-display text-2xl text-white mb-3">Karigar</p>
            <p className="text-sm leading-relaxed max-w-xs">
              A digital gallery of Pakistani craftsmanship — connecting
              independent artisans directly with the people who value their work.
            </p>
          </div>
          {FOOTER_SECTIONS.map((section) => (
            <div key={section.title}>
              <p className="font-mono text-[11px] uppercase tracking-wide text-white mb-4">{section.title}</p>
              <div className="space-y-2 text-sm">
                {section.links.map((link) =>
                  link.href ? (
                    <a key={link.label} href={link.href} className="block hover:text-brass-soft">
                      {link.label}
                    </a>
                  ) : (
                    <Link key={link.label} to={link.to} className="block hover:text-brass-soft">
                      {link.label}
                    </Link>
                  )
                )}
              </div>
            </div>
          ))}
        </div>
        <div className="max-w-5xl mx-auto pt-8 border-t border-white/15 text-center font-mono text-[11px] tracking-wide text-white/50">
          © 2026 Karigar. A gallery of Pakistani craftsmanship.
        </div>
      </footer>
    </div>
  );
}