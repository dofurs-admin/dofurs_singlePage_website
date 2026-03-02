# Service & Package System Documentation

## Overview

The Service & Package system is a comprehensive catalog management system that extends the existing `provider_services` table with:

- **Service Categories**: Organize services by type (e.g., "Grooming", "Training", "Healthcare")
- **Service Packages**: Bundle multiple services together with optional discounts
- **Service Add-ons**: Optional upgrades for services (e.g., nail trimming add-on)
- **Dynamic Pricing**: Calculate package prices on-the-fly based on component services
- **Media Management**: Icons, banners, and visual assets for catalog items

## Database Schema

### New Tables

#### `service_categories`
Groups services into manageable categories.

```sql
- id (uuid) - Primary key
- name (text) - Category name
- slug (text) - URL-friendly identifier (unique)
- description (text) - Category description
- icon_url (text) - Category icon
- banner_image_url (text) - Category banner
- display_order (int) - Sort order in UI
- is_featured (boolean) - Promote to featured categories
- is_active (boolean) - Soft delete flag
- created_at / updated_at (timestamptz)
```

#### `service_packages`
Bundled services with optional discounts.

```sql
- id (uuid) - Primary key
- category_id (uuid FK) - Associated category
- name (text) - Package name
- slug (text) - URL-friendly identifier (unique)
- short_description (text) - Brief description
- full_description (text) - Detailed description
- banner_image_url (text) - Package banner
- icon_url (text) - Package icon
- discount_type (text) - 'percentage' or 'fixed'
- discount_value (numeric) - Discount amount (for 'fixed') or % (for 'percentage')
- display_order (int) - Sort order
- is_featured (boolean) - Promote to featured packages
- is_active (boolean) - Soft delete flag
- created_at / updated_at (timestamptz)
```

**Pricing Behavior**:
- Base price = SUM of all component services' base_price
- Discount applied = (base_price × discount_value) / 100 if percentage, or discount_value if fixed
- Final price = max(0, base_price - discount)
- Calculated dynamically per booking; no static package prices in DB

#### `package_services`
Maps services to packages (many-to-many with metadata).

```sql
- id (uuid) - Primary key
- package_id (uuid FK) - Service package
- provider_service_id (uuid FK) - Provider service
- sequence_order (int) - Display order within package
- is_optional (boolean) - Whether service is optional in package
- created_at (timestamptz)
```

**Behavior**:
- Services are tied to a specific provider via `provider_service_id` FK
- Each provider can include/exclude services in packages
- Sequence order determines how services appear in booking flow
- Optional services can be toggled during checkout

#### `service_addons`
Optional upgrades for individual services.

```sql
- id (uuid) - Primary key
- provider_service_id (uuid FK) - Associated service
- name (text) - Add-on name (e.g., "Nail Trimming")
- description (text) - Add-on description
- price (numeric) - Add-on cost (added to service price)
- duration_minutes (int) - Additional booking duration
- icon_url (text) - Add-on icon
- display_order (int) - Sort order
- is_active (boolean) - Soft delete flag
- created_at / updated_at (timestamptz)
```

### Extended Tables

#### `provider_services`
Extended with catalog metadata:

```sql
-- New columns added
- category_id (uuid FK) - Associated category
- slug (text) - URL-friendly service identifier
- short_description (text)
- full_description (text)
- service_mode ('home_visit' | 'clinic_visit' | 'teleconsult')
- icon_url (text)
- banner_image_url (text)
- display_order (int)
- is_featured (boolean)
- requires_pet_details (boolean) - Booking requires pet info
- requires_location (boolean) - Booking requires location
- updated_at (timestamptz) - Auto-updated via trigger

-- Existing columns
- id, provider_id, service_type, base_price, surge_price, 
  commission_percentage, service_duration_minutes, is_active, created_at
```

**Key Points**:
- `base_price` is the per-booking cost (example: ₹1500 for grooming session)
- `surge_price` is optional premium (e.g., weekend +20%)
- `commission_percentage` is admin fee (e.g., 15%)
- No change to existing pricing logic; new fields are additive

#### `bookings`
Extended for package support:

```sql
-- New columns
- package_id (uuid FK) - If booking is package (not service)
- discount_amount (numeric) - Discount applied (if package)
- final_price (numeric) - Final amount after discounts

-- Existing columns
- price (for backward compatibility with service bookings)
```

**Booking Types**:
1. **Service Booking**: `booking_type = 'service'`
   - Uses `service_id` and provider service's `base_price`
   - Legacy; no package involvement

2. **Package Booking**: `booking_type = 'package'`
   - Uses `package_id`
   - Calculates price from component services
   - Applies package discount
   - Requires provider to have all services in package

## API Endpoints

### Public Endpoints (Read-Only)

#### GET `/api/services/categories`
List all active categories.

**Query Parameters:**
- `featured` (boolean, optional): Filter to featured categories only

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "Grooming",
      "slug": "grooming",
      "description": "...",
      "icon_url": "...",
      "banner_image_url": "...",
      "display_order": 1,
      "is_featured": true,
      "is_active": true,
      "created_at": "2024-01-01T00:00:00Z",
      "updated_at": "2024-01-01T00:00:00Z"
    }
  ]
}
```

#### GET `/api/services/by-category/[categoryId]`
Get all services in category for a provider.

**Query Parameters:**
- `providerId` (string, required): Provider UUID

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "provider_id": "uuid",
      "service_type": "Basic Grooming",
      "base_price": 1500,
      "surge_price": 300,
      "service_mode": "home_visit",
      "is_active": true,
      "...": "..."
    }
  ]
}
```

#### GET `/api/services/packages`
List all active packages.

**Query Parameters:**
- `categoryId` (string, optional): Filter by category
- `featured` (boolean, optional): Filter to featured packages

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "Premium Grooming Package",
      "slug": "premium-grooming",
      "discount_type": "percentage",
      "discount_value": 15,
      "is_featured": true,
      "is_active": true,
      "...": "..."
    }
  ]
}
```

#### GET `/api/services/package/[packageId]`
Get package composition with pricing.

**Query Parameters:**
- `providerId` (string, required): Provider UUID (for provider-specific pricing)

**Response:**
```json
{
  "success": true,
  "data": {
    "package": {
      "id": "uuid",
      "name": "Premium Grooming Package",
      "...": "..."
    },
    "services": [
      {
        "service": { "id", "service_type", "base_price", "..." },
        "sequence_order": 1,
        "is_optional": false
      },
      {
        "service": { "id", "service_type", "base_price", "..." },
        "sequence_order": 2,
        "is_optional": true
      }
    ],
    "totalBasePrice": 3000,
    "totalWithDiscount": 2550
  }
}
```

#### GET `/api/services/addons/[serviceId]`
Get add-ons for a service.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "provider_service_id": "uuid",
      "name": "Nail Trimming",
      "price": 300,
      "duration_minutes": 15,
      "icon_url": "...",
      "is_active": true,
      "...": "..."
    }
  ]
}
```

#### POST `/api/services/calculate-price`
Calculate booking price for service or package with add-ons.

**Request Body:**
```json
{
  "bookingType": "service" | "package",
  "serviceId": "uuid (required if bookingType='service')",
  "packageId": "uuid (required if bookingType='package')",
  "providerId": "uuid (required)",
  "addOns": [
    { "id": "uuid", "quantity": 1 }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "basePrice": 1500,
    "addOnPrice": 300,
    "discountAmount": 0,
    "finalPrice": 1800,
    "breakdown": [
      "Basic Grooming: ₹1500",
      "Nail Trimming (x1): ₹300"
    ]
  }
}
```

### Admin Endpoints (Protected - Requires Admin Role)

All admin endpoints require `Authorization: Bearer <TOKEN>` header with valid admin auth token.

#### POST `/api/admin/services/categories`
Create a service category.

**Request Body:**
```json
{
  "name": "Grooming",
  "slug": "grooming",
  "description": "Professional grooming services",
  "icon_url": "https://...",
  "banner_image_url": "https://...",
  "display_order": 1,
  "is_featured": true,
  "is_active": true
}
```

#### PUT `/api/admin/services/categories/[id]`
Update a service category.

#### DELETE `/api/admin/services/categories/[id]`
Delete a service category (soft delete via RLS).

#### POST `/api/admin/services/packages`
Create a service package.

**Request Body:**
```json
{
  "category_id": "uuid (optional)",
  "name": "Premium Grooming",
  "slug": "premium-grooming",
  "short_description": "Full grooming service",
  "full_description": "Includes bathing, drying, haircut, nail trim, ear clean",
  "discount_type": "percentage",
  "discount_value": 15,
  "display_order": 1,
  "is_featured": true,
  "is_active": true
}
```

#### PUT `/api/admin/services/packages/[id]`
Update a service package.

#### DELETE `/api/admin/services/packages/[id]`
Delete a service package.

#### POST `/api/admin/services/packages/[packageId]/services`
Add service to package.

**Request Body:**
```json
{
  "provider_service_id": "uuid",
  "sequence_order": 1,
  "is_optional": false
}
```

#### PATCH `/api/admin/services/packages/[packageId]/services`
Reorder services in package.

**Request Body:**
```json
[
  { "id": "uuid", "sequence_order": 1 },
  { "id": "uuid", "sequence_order": 2 }
]
```

#### DELETE `/api/admin/services/packages/[packageId]/services/[serviceId]`
Remove service from package.

#### POST `/api/admin/services/addons`
Create service add-on.

**Request Body:**
```json
{
  "provider_service_id": "uuid",
  "name": "Nail Trimming",
  "description": "Professional nail trimming",
  "price": 300,
  "duration_minutes": 15,
  "icon_url": "https://...",
  "display_order": 1,
  "is_active": true
}
```

#### PUT `/api/admin/services/addons/[id]`
Update a service add-on.

#### DELETE `/api/admin/services/addons/[id]`
Delete a service add-on.

## TypeScript Types

Available in `lib/service-catalog/types.ts`:

```typescript
// Categories
interface ServiceCategory { ... }
type ServiceCategoryInput = { ... }

// Services (provider_services extended)
interface Service { ... }
type ServiceMode = 'home_visit' | 'clinic_visit' | 'teleconsult'
type ServiceInput = { ... }
type ServiceUpdate = { ... }

// Packages
interface ServicePackage { ... }
type ServicePackageInput = { ... }
interface PackageService { ... }
interface PackageComposition { ... }

// Add-ons
interface ServiceAddon { ... }
type ServiceAddonInput = { ... }

// Bookings
interface BookingWithPackaging { ... }
type BookingPricingInput = { ... }

// API Responses
interface ApiResponse<T> { ... }
interface PaginatedResponse<T> { ... }
```

## Utility Functions

Available in `lib/service-catalog/utils.ts`:

### Pricing

```typescript
calculatePackagePrice(packageId, providerId)
// Returns: { basePrice, discountAmount, finalPrice, serviceCount }

calculateBookingPrice(params)
// Calculates total price for service/package + add-ons
// Returns: { basePrice, addOnPrice, discountAmount, finalPrice, breakdown }
```

### Fetching Data

```typescript
getActiveCategories()
getServicesByCategory(categoryId, providerId)
getActivePackages()
getServiceAddOns(serviceId)
```

### Management (Admin)

```typescript
addServiceToPackage(packageId, serviceId, sequenceOrder, isOptional)
removeServiceFromPackage(packageServiceId)
reorderPackageServices(packageId, serviceOrdering)
```

### Validation

```typescript
validateService(serviceId, providerId)
validatePackage(packageId)
```

## Row-Level Security (RLS)

All service catalog tables have RLS enabled with these policies:

### service_categories
- **ADMIN**: Full CRUD
- **AUTH**: Read-only active categories

### provider_services
- **ADMIN**: Full CRUD
- **PROVIDER**: View own services; full CRUD on own
- **AUTH**: Read-only active services

### service_packages
- **ADMIN**: Full CRUD
- **AUTH**: Read-only active packages

### package_services
- **ADMIN**: Full CRUD
- **AUTH**: Read if package is active

### service_addons
- **ADMIN**: Full CRUD
- **PROVIDER**: CRUD on own service add-ons
- **AUTH**: Read-only active add-ons

### bookings (extended)
- **ADMIN**: Full CRUD
- **PROVIDER**: Read own bookings; update status only (cannot modify pricing)
- **USER**: Read/create own bookings; update status only

## Implementation Guide

### 1. Database Migration
Apply migration files in order:
```bash
# Applies schema, tables, indexes, triggers, functions
030_service_catalog_system.sql

# Applies RLS policies
031_service_catalog_rls_policies.sql
```

### 2. Use in Booking Flow

**Frontend (React component):**
```typescript
// Fetch categories
const categories = await fetch('/api/services/categories').then(r => r.json());

// Fetch packages in category
const packages = await fetch(
  `/api/services/packages?categoryId=${category.id}`
).then(r => r.json());

// Get package details with pricing
const composition = await fetch(
  `/api/services/package/${package.id}?providerId=${provider.id}`
).then(r => r.json());

// Calculate final price
const pricing = await fetch('/api/services/calculate-price', {
  method: 'POST',
  body: JSON.stringify({
    bookingType: 'package',
    packageId: package.id,
    providerId: provider.id,
    addOns: selectedAddOns
  })
}).then(r => r.json());

// Create booking with package
const booking = await supabase
  .from('bookings')
  .insert({
    user_id: userId,
    provider_id: providerId,
    booking_type: 'package',
    package_id: packageId,
    discount_amount: pricing.data.discountAmount,
    final_price: pricing.data.finalPrice,
    // ... other booking fields
  });
```

### 3. Admin Dashboard Integration

Create admin section in `components/dashboard/AdminDashboardClient.tsx` for:
- Category CRUD (create, edit, reorder, toggle active)
- Package builder (add services, set orders, set discounts, preview price)
- Add-on management (attach to services, set prices)
- Bulk operations (import/export, bulk pricing updates)

### 4. Provider Dashboard Integration

Manage own services:
- Assign categories to services
- Set service metadata (duration, mode, requirements)
- Upload service icons/banners

## Migration Safety

**No Changes to Existing Data**:
- `provider_services` retains all existing columns and data
- `bookings` retains all existing columns and logic
- Old service bookings continue to work unchanged
- Package bookings use new columns (package_id, final_price, discount_amount)

**Backward Compatibility**:
- Existing provider_service pricing logic untouched
- Service bookings use `price` column (legacy)
- Package bookings use `final_price` column (new)
- Both booking types use same `status` tracking logic

## Error Handling

API errors follow consistent pattern:

```json
{
  "success": false,
  "error": "Human-readable error message"
}
```

HTTP Status Codes:
- `200`: Success
- `201`: Created successfully
- `400`: Validation error (missing required fields)
- `403`: Permission denied (not admin)
- `404`: Resource not found
- `500`: Server error

## Performance Considerations

1. **Lazy Loading**: Fetch categories first, then packages/services on demand
2. **Caching**: Consider caching active categories/packages (expires hourly)
3. **Indexes**: Queries use indexes on `is_active`, `category_id`, `provider_id`, `slug`
4. **Dynamic Pricing**: Package prices calculated at booking time (no stale data)
5. **Display Order**: Services/categories sorted by `display_order` column (fast sort in SQL)

## Testing

### Unit Tests
Test pricing logic:
- Service with no discounts
- Package with percentage discount
- Package with fixed discount
- Add-on calculations
- Edge cases (zero prices, negative prices)

### Integration Tests
Test API endpoints:
- GET categories, packages, services
- POST admin create operations
- Price calculations with various combinations
- RLS policies (ensure data is properly filtered)

### E2E Tests
Test booking flow:
- User selects package
- System calculates price correctly
- Booking saves with correct package_id and price
