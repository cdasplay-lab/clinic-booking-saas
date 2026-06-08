-- Multi-tier pricing: wholesale + VIP prices on products
ALTER TABLE "Product" ADD COLUMN "wholesalePrice" DECIMAL(18,4) NOT NULL DEFAULT 0;
ALTER TABLE "Product" ADD COLUMN "vipPrice" DECIMAL(18,4) NOT NULL DEFAULT 0;

-- Price level per customer (RETAIL | WHOLESALE | VIP) — drives auto-pricing
ALTER TABLE "Contact" ADD COLUMN "priceLevel" TEXT NOT NULL DEFAULT 'RETAIL';
