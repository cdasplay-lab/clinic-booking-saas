-- Stock count sessions + lines
CREATE TABLE "StockCount" (
    "id"             TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "warehouseId"    TEXT NOT NULL,
    "number"         TEXT NOT NULL,
    "status"         TEXT NOT NULL DEFAULT 'DRAFT',
    "notes"          TEXT,
    "postedAt"       TIMESTAMP(3),
    "journalId"      TEXT,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"      TIMESTAMP(3) NOT NULL,
    CONSTRAINT "StockCount_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "StockCount_organizationId_status_idx"      ON "StockCount"("organizationId", "status");
CREATE INDEX "StockCount_organizationId_createdAt_idx"   ON "StockCount"("organizationId", "createdAt" DESC);
ALTER TABLE "StockCount" ADD CONSTRAINT "StockCount_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StockCount" ADD CONSTRAINT "StockCount_warehouseId_fkey"    FOREIGN KEY ("warehouseId")    REFERENCES "Warehouse"("id")    ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "StockCountLine" (
    "id"           TEXT NOT NULL,
    "stockCountId" TEXT NOT NULL,
    "productId"    TEXT NOT NULL,
    "systemQty"    DECIMAL(18,4) NOT NULL DEFAULT 0,
    "countedQty"   DECIMAL(18,4) NOT NULL DEFAULT 0,
    "variance"     DECIMAL(18,4) NOT NULL DEFAULT 0,
    "unitCost"     DECIMAL(18,4) NOT NULL DEFAULT 0,
    CONSTRAINT "StockCountLine_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "StockCountLine_stockCountId_productId_key" ON "StockCountLine"("stockCountId", "productId");
CREATE INDEX "StockCountLine_stockCountId_idx" ON "StockCountLine"("stockCountId");
ALTER TABLE "StockCountLine" ADD CONSTRAINT "StockCountLine_stockCountId_fkey" FOREIGN KEY ("stockCountId") REFERENCES "StockCount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StockCountLine" ADD CONSTRAINT "StockCountLine_productId_fkey"    FOREIGN KEY ("productId")    REFERENCES "Product"("id")     ON DELETE RESTRICT ON UPDATE CASCADE;

-- Add ADJUSTMENT to JournalType enum (stock count / inventory adjustment entries)
ALTER TYPE "JournalType" ADD VALUE IF NOT EXISTS 'ADJUSTMENT';

-- Sales rep + commission
ALTER TABLE "Employee" ADD COLUMN "commissionRate" DECIMAL(5,2);
ALTER TABLE "Invoice"  ADD COLUMN "salespersonId"  TEXT;
ALTER TABLE "Invoice"  ADD CONSTRAINT "Invoice_salespersonId_fkey" FOREIGN KEY ("salespersonId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "SalesCommission" (
    "id"             TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "invoiceId"      TEXT NOT NULL,
    "employeeId"     TEXT NOT NULL,
    "invoiceTotal"   DECIMAL(18,4) NOT NULL,
    "rate"           DECIMAL(8,4) NOT NULL,
    "amount"         DECIMAL(18,4) NOT NULL,
    "status"         TEXT NOT NULL DEFAULT 'PENDING',
    "paidAt"         TIMESTAMP(3),
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SalesCommission_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SalesCommission_invoiceId_key"              ON "SalesCommission"("invoiceId");
CREATE INDEX "SalesCommission_organizationId_employeeId_idx"     ON "SalesCommission"("organizationId", "employeeId", "status");
CREATE INDEX "SalesCommission_organizationId_status_idx"         ON "SalesCommission"("organizationId", "status");
ALTER TABLE "SalesCommission" ADD CONSTRAINT "SalesCommission_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SalesCommission" ADD CONSTRAINT "SalesCommission_invoiceId_fkey"      FOREIGN KEY ("invoiceId")      REFERENCES "Invoice"("id")      ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SalesCommission" ADD CONSTRAINT "SalesCommission_employeeId_fkey"     FOREIGN KEY ("employeeId")     REFERENCES "Employee"("id")     ON DELETE RESTRICT ON UPDATE CASCADE;
