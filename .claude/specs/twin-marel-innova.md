# Feature Spec: Marel Innova Production Control Twin

**Slug:** `twin-marel-innova`
**Created:** 2026-03-11
**Status:** draft
**Priority:** high

---

## Overview

A digital twin that simulates Marel Innova's production control system as used at Ode's Vartdal processing plant. Unlike typical REST API twins, this twin replicates Innova's staging table pattern (JSON payloads in SQL tables) while also providing a REST convenience wrapper for development. It covers production orders, product definitions, yields, inventory, quality control, and packing/palletizing for cod processing operations running approximately 30-50 tonnes/day.

## Problem Statement

Ode's Vartdal plant runs Marel Innova for production control. The real system integrates via WCF services, SQL staging tables with JSON payloads, and OPC-UA -- none of which are practical for rapid integration development. A digital twin that simulates Innova's data structures and provides both the staging table pattern and a REST wrapper lets developers build integrations without needing access to the live production floor system or its complex protocols.

## Out of Scope

- NOT: WCF service simulation (twin provides REST wrapper instead)
- NOT: OPC-UA protocol implementation (twin exposes OPC-UA data points via REST)
- NOT: SmartBase IoT sensor simulation (sensor data is pre-generated)
- NOT: Real-time PLC communication
- NOT: Innova user interface or HMI simulation
- NOT: Multi-plant support (twin serves only Vartdal)
- NOT: Equipment maintenance scheduling
- NOT: Actual yield optimization algorithms

---

## User Stories

### Story 1: Production Orders

**As a** developer integrating with Innova
**I want to** create and read production orders for cod processing
**So that** I can build production planning and tracking features

**Acceptance Criteria:**

- GIVEN the twin is running WHEN I GET /api/v1/production-orders THEN I receive a list of production orders with fields: orderId, orderNumber, species, productType, targetQuantityKg, actualQuantityKg, status, plannedDate, startedAt, completedAt, shiftId, lineId
- GIVEN the twin has data WHEN I GET /api/v1/production-orders?status=in_progress THEN I receive only active orders
- GIVEN the twin has data WHEN I GET /api/v1/production-orders?date=2026-03-10 THEN I receive orders for that production date
- GIVEN valid data WHEN I POST /api/v1/production-orders THEN a new order is created with status "planned"
- GIVEN the twin has data WHEN I GET /api/v1/production-orders/:id THEN I receive the full order with nested yield data
- GIVEN the staging table pattern WHEN I query the staging table THEN I find the same order as a JSON payload in the innova_staging table with messageType "ProductionOrder"

**Test Requirements:**

- [ ] Test: GET production orders returns records with all required fields
- [ ] Test: Species is always "Atlantic Cod" (Gadus morhua) for Ode
- [ ] Test: Product types include: whole_gutted, fillet, loin, medallion, portion, frozen_block
- [ ] Test: Status values include: planned, in_progress, completed, cancelled
- [ ] Test: POST creates order and it appears in both REST response and staging table
- [ ] Test: Filtering by status and date works correctly
- [ ] Test: Target quantities are realistic (individual orders typically 1-10 tonnes)

**Technical Notes:**

Innova uses a staging table pattern where integrations read/write JSON messages to SQL tables. The twin implements both: a `innova_staging` table with columns (id, messageType, payload JSON, status, createdAt, processedAt) AND a REST wrapper that reads/writes the same underlying data. Production orders at Vartdal process Atlantic cod into various product forms. Shift IDs correspond to day shift (06:00-14:00) and evening shift (14:00-22:00).

---

### Story 2: Product Definitions

**As a** developer integrating with Innova
**I want to** retrieve the product catalog matching Ode's Snow Cod product lines
**So that** I can map production output to commercial products

**Acceptance Criteria:**

- GIVEN the twin is running WHEN I GET /api/v1/products THEN I receive the full product catalog
- GIVEN the twin has data WHEN I GET /api/v1/products?category=fillet THEN I receive only fillet products
- GIVEN the twin has data WHEN I GET /api/v1/products/:id THEN I receive full product details including specifications
- GIVEN the twin has data THEN the product catalog includes all Snow Cod product lines

**Test Requirements:**

- [ ] Test: Product catalog includes entries for: whole gutted cod, skin-on fillets, skinless fillets, loins, medallions, portions, frozen blocks
- [ ] Test: Each product has fields: productId, sku, name, category, species, weightRangeMin, weightRangeMax, packagingType, storageTemp, shelfLifeDays
- [ ] Test: Products map to realistic Snow Cod SKUs
- [ ] Test: Weight ranges are realistic for cod products (e.g., fillets 200-800g, loins 150-400g)
- [ ] Test: Storage temperatures are correct (fresh: 0-4C, frozen: -18C or below)

**Technical Notes:**

Snow Cod is Ode's premium brand. Product lines include fresh and frozen variants. Packaging types: MAP (modified atmosphere), vacuum, IQF (individually quick frozen), block frozen. Include both retail and foodservice/HoReCa pack sizes. Each product has a unique SKU structure.

---

### Story 3: Production Data (Yields, Throughput, Waste)

**As a** developer integrating with Innova
**I want to** read production yields, throughput, and waste data per production run
**So that** I can build efficiency dashboards and yield tracking features

**Acceptance Criteria:**

- GIVEN the twin has data WHEN I GET /api/v1/production-data?orderId=:id THEN I receive yield data for that production order
- GIVEN the twin has data WHEN I GET /api/v1/production-data/summary?date=:date THEN I receive aggregated daily production summary
- GIVEN the twin has data WHEN I GET /api/v1/production-data/yields?lineId=:id&from=:date&to=:date THEN I receive yield trends for a processing line over time

**Test Requirements:**

- [ ] Test: Production data includes fields: dataId, orderId, lineId, rawInputKg, finishedOutputKg, yieldPercentage, wasteKg, wasteCategory, throughputKgPerHour, timestamp
- [ ] Test: Yield percentages are realistic for cod (whole to fillet: ~45-55%, whole to loin: ~25-35%)
- [ ] Test: Waste categories include: head, bone, skin, trim, downgrade, other
- [ ] Test: Daily summary aggregates correctly across all orders for that date
- [ ] Test: Throughput rates are realistic (line capacity ~2-5 tonnes/hour per line)
- [ ] Test: Yield data also appears in staging table with messageType "ProductionYield"

**Technical Notes:**

Cod yield ratios: whole round to gutted ~85-88%, gutted to fillet ~50-55%, fillet to loin ~55-65% of fillet weight. These vary by fish size, season, and operator skill. Waste streams have commercial value (heads/bones for stock, skin for collagen, trim for mince). The Vartdal plant runs multiple parallel processing lines.

---

### Story 4: Inventory

**As a** developer integrating with Innova
**I want to** track finished goods inventory at Vartdal including pallet positions
**So that** I can build inventory management and order fulfillment features

**Acceptance Criteria:**

- GIVEN the twin has data WHEN I GET /api/v1/inventory THEN I receive current inventory levels by product
- GIVEN the twin has data WHEN I GET /api/v1/inventory?productId=:id THEN I receive inventory for a specific product
- GIVEN the twin has data WHEN I GET /api/v1/inventory/pallets THEN I receive individual pallet records with location
- GIVEN the twin has data WHEN I GET /api/v1/inventory/pallets/:palletId THEN I receive full pallet details including contents and traceability

**Test Requirements:**

- [ ] Test: Inventory summary includes fields: productId, productName, totalQuantityKg, totalPallets, storageZone, oldestBatchDate
- [ ] Test: Pallet records include: palletId, sscc (Serial Shipping Container Code), productId, quantityKg, productionDate, bestBeforeDate, storageZone, location, status
- [ ] Test: Storage zones include: fresh_holding (0-4C), frozen_storage (-18C), dispatch_area
- [ ] Test: SSCC codes follow GS1 standard format (18 digits)
- [ ] Test: Best-before dates are realistic (fresh cod: 10-14 days from production, frozen: 18-24 months)
- [ ] Test: Total inventory levels are realistic for a plant processing 30-50 tonnes/day

**Technical Notes:**

Vartdal has cold storage (fresh holding area, frozen storage) and a dispatch/loading area. Pallets use SSCC barcodes per GS1 standards. Each pallet holds typically 400-800 kg depending on product. Inventory turns over quickly for fresh products (shipped within 1-3 days) but frozen inventory may accumulate. Include pallet status: in_production, in_storage, reserved, dispatched.

---

### Story 5: Quality Control

**As a** developer integrating with Innova
**I want to** read temperature logs, weight checks, and quality grades
**So that** I can build quality assurance and compliance features

**Acceptance Criteria:**

- GIVEN the twin has data WHEN I GET /api/v1/quality/temperature-logs?zone=:zone&from=:date&to=:date THEN I receive temperature readings for that storage zone
- GIVEN the twin has data WHEN I GET /api/v1/quality/weight-checks?orderId=:id THEN I receive weight check samples for that order
- GIVEN the twin has data WHEN I GET /api/v1/quality/grades?orderId=:id THEN I receive quality grade distribution for that order
- GIVEN the twin has data WHEN I GET /api/v1/quality/alerts THEN I receive any active quality alerts (temperature excursions, weight deviations)

**Test Requirements:**

- [ ] Test: Temperature logs include fields: logId, zone, sensorId, temperature, timestamp, inRange (boolean)
- [ ] Test: Fresh zones maintain 0-4C, frozen zones maintain below -18C
- [ ] Test: Weight checks include: checkId, orderId, productId, targetWeightG, actualWeightG, deviation, passed (boolean)
- [ ] Test: Quality grades include: gradeId, orderId, grade (A/B/C/reject), count, percentage
- [ ] Test: Grade A percentage is typically 80-90% for healthy cod batches
- [ ] Test: Temperature readings are generated every 15 minutes per zone
- [ ] Test: Occasional temperature excursion alerts exist in the data (realistic -- fridges have brief spikes)

**Technical Notes:**

Norwegian food safety (Mattilsynet) requires continuous temperature monitoring and HACCP compliance. Quality grades for cod: A (premium, no defects), B (minor defects, discoloration), C (significant defects, suitable for processing only), Reject (not food grade). Weight checks are sampled (every Nth unit on the line). Include a small percentage of out-of-range readings to test alert handling.

---

### Story 6: Packing and Palletizing

**As a** developer integrating with Innova
**I want to** read packing records and pallet assignments including label data
**So that** I can build packing verification and shipping features

**Acceptance Criteria:**

- GIVEN the twin has data WHEN I GET /api/v1/packing/records?orderId=:id THEN I receive packing records for that order
- GIVEN the twin has data WHEN I GET /api/v1/packing/pallets/:palletId/label THEN I receive label data for a pallet (GS1-128 barcode content)
- GIVEN the twin has data WHEN I GET /api/v1/packing/fulfillment?customerOrderId=:id THEN I receive order fulfillment status with assigned pallets

**Test Requirements:**

- [ ] Test: Packing records include: recordId, orderId, palletId, productId, boxCount, totalWeightKg, packedAt, operatorId, lineId
- [ ] Test: Label data includes: sscc, gtin, productionDate, bestBeforeDate, batchNumber, netWeightKg, countryOfOrigin ("NO")
- [ ] Test: Fulfillment status includes: customerOrderId, requestedQuantityKg, packedQuantityKg, palletIds, status (partial/complete/dispatched)
- [ ] Test: Country of origin is always "NO" (Norway)
- [ ] Test: GTIN codes follow GS1 format (13 or 14 digits)
- [ ] Test: Box counts and weights are consistent with product specifications

**Technical Notes:**

GS1-128 labels carry structured data: SSCC (AI 00), GTIN (AI 01/02), production date (AI 11), best before (AI 15), batch (AI 10), net weight (AI 310x). Ode ships to customers across Europe and Asia -- customer orders specify quantity, and fulfillment tracks how many pallets are assigned to each order. Label data must be machine-readable for logistics partners.

---

### Story 7: Data Generation

**As a** developer
**I want to** have realistic pre-generated processing data matching Vartdal plant operations
**So that** the twin provides a believable production control environment

**Acceptance Criteria:**

- GIVEN the twin starts WHEN the data generator runs THEN it creates production history for the last 30 days
- GIVEN the generated data WHEN I inspect production orders THEN daily throughput is 30-50 tonnes with realistic variation
- GIVEN the generated data WHEN I inspect yields THEN yield percentages match cod processing norms
- GIVEN the generated data WHEN I inspect inventory THEN current stock levels reflect recent production minus shipments
- GIVEN the generated data WHEN I inspect quality data THEN grade distributions are realistic with occasional quality alerts
- GIVEN the twin restarts WHEN data is regenerated with the same seed THEN identical data is produced

**Test Requirements:**

- [ ] Test: 30 days of production history exists with 2 shifts per day
- [ ] Test: Daily production is 30-50 tonnes raw input with day-to-day variation
- [ ] Test: Product mix reflects Ode's actual lines (fillets are highest volume, followed by whole gutted, then loins and portions)
- [ ] Test: Weekend production is reduced or absent (depending on season)
- [ ] Test: Yield percentages vary realistically around expected means
- [ ] Test: Inventory includes both fresh (recent production) and frozen stock
- [ ] Test: Staging table contains corresponding JSON records for all production data
- [ ] Test: Deterministic seeding produces identical output on re-run

**Technical Notes:**

Use the foundation data generation library. Production patterns: 2 shifts/day on weekdays (06:00-14:00, 14:00-22:00), Saturday sometimes runs 1 shift during peak season, Sunday typically no production. Processing lines: 3-4 fillet lines, 1 whole-fish line, 1 value-added (loins/medallions). Raw material arrives from Ode's 10 sea sites. Seasonal variation: peak harvest Nov-Mar for cod.

---

## Technical Design

### Data Model Changes

**Tables:**

| Table | Key Columns | Purpose |
|-------|------------|---------|
| innova_staging | id, messageType, payload (JSON), status, createdAt, processedAt | Staging table pattern (core Innova integration) |
| production_orders | orderId, orderNumber, species, productType, targetQuantityKg, status, shiftId, lineId | Production orders |
| products | productId, sku, name, category, species, weightRangeMin, weightRangeMax, packagingType, storageTemp | Product catalog |
| production_data | dataId, orderId, lineId, rawInputKg, finishedOutputKg, yieldPercentage, wasteKg, wasteCategory | Yield and throughput records |
| inventory | inventoryId, productId, palletId, quantityKg, storageZone, location, status | Current inventory |
| pallets | palletId, sscc, productId, quantityKg, productionDate, bestBeforeDate, status | Pallet master records |
| quality_temperature_logs | logId, zone, sensorId, temperature, timestamp, inRange | Temperature monitoring |
| quality_weight_checks | checkId, orderId, productId, targetWeightG, actualWeightG, passed | Weight sampling |
| quality_grades | gradeId, orderId, grade, count, percentage | Grade distribution per order |
| packing_records | recordId, orderId, palletId, productId, boxCount, totalWeightKg, operatorId | Packing line output |
| customer_orders | customerOrderId, customerName, requestedQuantityKg, status | Customer order tracking |

### API Changes

Base path: `/api/v1`

| Method | Path | Description |
|--------|------|-------------|
| GET | /production-orders | List production orders (filterable) |
| POST | /production-orders | Create production order |
| GET | /production-orders/:id | Get single order with yield data |
| GET | /products | List product catalog |
| GET | /products/:id | Get single product |
| GET | /production-data | Get yield/throughput data (filterable) |
| GET | /production-data/summary | Daily summary |
| GET | /production-data/yields | Yield trends over time |
| GET | /inventory | Current inventory levels |
| GET | /inventory/pallets | Individual pallet records |
| GET | /inventory/pallets/:palletId | Single pallet detail |
| GET | /quality/temperature-logs | Temperature readings (filterable) |
| GET | /quality/weight-checks | Weight check samples |
| GET | /quality/grades | Quality grade distribution |
| GET | /quality/alerts | Active quality alerts |
| GET | /packing/records | Packing records (filterable) |
| GET | /packing/pallets/:palletId/label | GS1-128 label data |
| GET | /packing/fulfillment | Order fulfillment status |
| GET | /staging | Read staging table entries (raw Innova pattern) |
| POST | /staging | Write to staging table (raw Innova pattern) |

### Dependencies

- Foundation auth library (bearer token authentication)
- Foundation data generation library (seeded random data)
- SQLite (data storage, including JSON support for staging table)
- Express.js (HTTP framework)

### Security Considerations

- All endpoints require valid bearer token (foundation auth)
- Staging table access requires specific scope/role
- No real production data -- all generated
- Quality alerts are simulated and clearly marked as non-real

---

## Implementation Order

### Group 1 (parallel -- foundational catalogs)
- Story 2: Product definitions -- creates product catalog, no dependencies
- Story 1: Production orders -- creates order structure and staging table pattern

### Group 2 (parallel -- depends on Group 1 for orders and products)
- Story 3: Production data (yields) -- depends on orders and products
- Story 5: Quality control -- depends on orders (for weight checks and grades)

### Group 3 (parallel -- depends on Group 1 and 2)
- Story 4: Inventory -- depends on production data and products
- Story 6: Packing and palletizing -- depends on orders, products, and inventory (pallet records)

### Group 4 (sequential -- depends on all above)
- Story 7: Data generation -- generates 30-day history using all models

**Parallel safety rules:**
- Stories in the same group must touch DIFFERENT files/folders
- If two stories might edit the same file, they go in different groups
- Database migrations must be sequential (never parallel)
- Shared utilities/helpers: the story that creates them goes first

---

## Development Approach

### Simplifications (what starts simple)

- Staging table uses simple JSON column in SQLite instead of full SQL Server staging pattern
- No WCF service endpoints -- REST only with staging table for pattern fidelity
- OPC-UA data points exposed as REST endpoints, not actual OPC-UA protocol
- GS1 codes generated but not validated against a real GS1 registry
- Customer orders are simple records, not integrated with an ERP

### Upgrade Path (what changes for production)

- "Add WCF service endpoints for Innova-native integration" would be a separate story
- "Add OPC-UA server for real protocol testing" would be a separate story
- "Integrate customer orders with ERP/order management system" would be a separate story
- "Add real-time production line simulation with event streams" would be a separate story

### Architecture Decisions

- Dual access pattern (staging table + REST) reflects how real Innova integrations work -- some systems poll the staging table, others use a middleware REST layer
- Staging table messageType values mirror Innova's actual message types
- Quality data kept separate from production data (different tables) to match how Innova's modules are structured
- Pallet lifecycle (production -> storage -> dispatch) modeled as status transitions on the pallet record

---

## Verification Checklist

Before this feature is marked complete:

- [ ] All user stories implemented
- [ ] All acceptance criteria met
- [ ] All tests written and passing
- [ ] Tests verify real behavior (not just status codes)
- [ ] Edge cases handled
- [ ] No regressions in existing tests
- [ ] Code committed with proper messages
- [ ] Staging table pattern works alongside REST endpoints
- [ ] Yield percentages are realistic for cod processing
- [ ] 30 days of production history with realistic throughput
- [ ] GS1 label data follows standard format
- [ ] Ready for human review
