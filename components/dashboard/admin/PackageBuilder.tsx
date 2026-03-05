'use client';

import { useState, useTransition } from 'react';
import { useToast } from '@/components/ui/ToastProvider';
import ImageUploadField from '@/components/ui/ImageUploadField';
import type { ServicePackage, ServiceCategory, PackageComposition } from '@/lib/service-catalog/types';

type PackageBuilderProps = {
  initialPackages: ServicePackage[];
  categories: ServiceCategory[];
  providers: Array<{
    id: number;
    name: string;
  }>;
};

type PackageDraft = {
  id?: string;
  category_id: string;
  name: string;
  slug: string;
  short_description: string;
  full_description: string;
  banner_image_url: string;
  icon_url: string;
  discount_type: 'percentage' | 'fixed' | '';
  discount_value: string;
  display_order: string;
  is_featured: boolean;
  is_active: boolean;
};

export default function PackageBuilder({ initialPackages, categories, providers }: PackageBuilderProps) {
  const [packages, setPackages] = useState<ServicePackage[]>(initialPackages);
  const [selectedPackage, setSelectedPackage] = useState<ServicePackage | null>(null);
  const [composition, setComposition] = useState<PackageComposition | null>(null);
  const [selectedProviderId, setSelectedProviderId] = useState<string>(
    providers[0] ? providers[0].id.toString() : ''
  );
  const [isPending, startTransition] = useTransition();
  const { showToast } = useToast();
  const [packageDraft, setPackageDraft] = useState<PackageDraft>({
    category_id: '',
    name: '',
    slug: '',
    short_description: '',
    full_description: '',
    banner_image_url: '',
    icon_url: '',
    discount_type: '',
    discount_value: '0',
    display_order: '0',
    is_featured: false,
    is_active: true,
  });

  function setPackageDraftField<K extends keyof PackageDraft>(field: K, value: PackageDraft[K]) {
    setPackageDraft((current) => ({ ...current, [field]: value }));
  }

  function resetPackageDraft() {
    setPackageDraft({
      category_id: '',
      name: '',
      slug: '',
      short_description: '',
      full_description: '',
      banner_image_url: '',
      icon_url: '',
      discount_type: '',
      discount_value: '0',
      display_order: '0',
      is_featured: false,
      is_active: true,
    });
  }

  function loadPackageInDraft(pkg: ServicePackage) {
    setPackageDraft({
      id: pkg.id,
      category_id: pkg.category_id || '',
      name: pkg.name,
      slug: pkg.slug,
      short_description: pkg.short_description || '',
      full_description: pkg.full_description || '',
      banner_image_url: pkg.banner_image_url || '',
      icon_url: pkg.icon_url || '',
      discount_type: pkg.discount_type || '',
      discount_value: pkg.discount_value?.toString() || '0',
      display_order: pkg.display_order.toString(),
      is_featured: pkg.is_featured,
      is_active: pkg.is_active,
    });
  }

  function savePackage() {
    if (!packageDraft.name.trim() || !packageDraft.slug.trim()) {
      showToast('Name and slug are required.', 'error');
      return;
    }

    startTransition(async () => {
      try {
        const payload = {
          category_id: packageDraft.category_id || null,
          name: packageDraft.name.trim(),
          slug: packageDraft.slug.trim().toLowerCase(),
          short_description: packageDraft.short_description.trim() || null,
          full_description: packageDraft.full_description.trim() || null,
          banner_image_url: packageDraft.banner_image_url.trim() || null,
          icon_url: packageDraft.icon_url.trim() || null,
          discount_type: packageDraft.discount_type || null,
          discount_value: packageDraft.discount_type ? parseFloat(packageDraft.discount_value) || 0 : null,
          display_order: parseInt(packageDraft.display_order) || 0,
          is_featured: packageDraft.is_featured,
          is_active: packageDraft.is_active,
        };

        const url = packageDraft.id
          ? `/api/admin/services/packages/${packageDraft.id}`
          : '/api/admin/services/packages';

        const method = packageDraft.id ? 'PUT' : 'POST';

        const response = await fetch(url, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || 'Failed to save package');
        }

        if (packageDraft.id) {
          setPackages((current) =>
            current.map((pkg) => (pkg.id === packageDraft.id ? result.data : pkg))
          );
          showToast('Package updated successfully.', 'success');
        } else {
          setPackages((current) => [...current, result.data]);
          showToast('Package created successfully.', 'success');
        }

        resetPackageDraft();
      } catch (error) {
        showToast(error instanceof Error ? error.message : 'Failed to save package', 'error');
      }
    });
  }

  function deletePackage(packageId: string) {
    if (!confirm('Are you sure you want to delete this package?')) {
      return;
    }

    startTransition(async () => {
      try {
        const response = await fetch(`/api/admin/services/packages/${packageId}`, {
          method: 'DELETE',
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || 'Failed to delete package');
        }

        setPackages((current) => current.filter((pkg) => pkg.id !== packageId));
        showToast('Package deleted successfully.', 'success');
      } catch (error) {
        showToast(error instanceof Error ? error.message : 'Failed to delete package', 'error');
      }
    });
  }

  function viewPackageComposition(pkg: ServicePackage) {
    if (!selectedProviderId) {
      showToast('Select a provider to preview package composition pricing.', 'error');
      return;
    }

    setSelectedPackage(pkg);
    setComposition(null);

    startTransition(async () => {
      try {
        const response = await fetch(`/api/services/package/${pkg.id}?providerId=${encodeURIComponent(selectedProviderId)}`);
        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || 'Failed to fetch package composition');
        }

        setComposition(result.data);
      } catch (error) {
        showToast(
          error instanceof Error ? error.message : 'Failed to load package composition',
          'error'
        );
      }
    });
  }

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-[#f2dfcf] bg-white p-6 shadow-soft-md">
        <h2 className="text-xl font-semibold text-ink">Package Builder</h2>
        <p className="mt-1 text-xs text-[#6b6b6b]">
          Create service packages with bundled services and optional discounts.
        </p>

        <div className="mt-4 rounded-xl border border-[#f2dfcf] p-4">
          <p className="text-sm font-semibold text-ink">
            {packageDraft.id ? 'Edit Package' : 'Create New Package'}
          </p>
          <div className="mt-3 space-y-4">
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-ink">Category (Optional)</label>
              <select
                value={packageDraft.category_id}
                onChange={(event) => setPackageDraftField('category_id', event.target.value)}
                className="w-full rounded-xl border border-[#f2dfcf] px-3 py-2 text-xs"
              >
                <option value="">Select Category (Optional)</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
              <p className="text-[10px] text-[#6b6b6b]">Group this package under a category for better organization</p>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-semibold text-ink">Package Name *</label>
              <input
                value={packageDraft.name}
                onChange={(event) => setPackageDraftField('name', event.target.value)}
                placeholder="e.g., Premium Grooming Package"
                className="w-full rounded-xl border border-[#f2dfcf] px-3 py-2 text-xs"
              />
              <p className="text-[10px] text-[#6b6b6b]">Name of the service package</p>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-semibold text-ink">Slug *</label>
              <input
                value={packageDraft.slug}
                onChange={(event) => setPackageDraftField('slug', event.target.value)}
                placeholder="e.g., premium-grooming (lowercase, hyphens only)"
                className="w-full rounded-xl border border-[#f2dfcf] px-3 py-2 text-xs"
              />
              <p className="text-[10px] text-[#6b6b6b]">URL-friendly identifier (auto-converted to lowercase)</p>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-semibold text-ink">Short Description</label>
              <input
                value={packageDraft.short_description}
                onChange={(event) => setPackageDraftField('short_description', event.target.value)}
                placeholder="Brief one-liner for package cards"
                className="w-full rounded-xl border border-[#f2dfcf] px-3 py-2 text-xs"
              />
              <p className="text-[10px] text-[#6b6b6b]">Appears on cards and listings</p>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-semibold text-ink">Full Description</label>
              <textarea
                value={packageDraft.full_description}
                onChange={(event) => setPackageDraftField('full_description', event.target.value)}
                placeholder="Detailed description of package contents and benefits"
                rows={3}
                className="w-full rounded-xl border border-[#f2dfcf] px-3 py-2 text-xs"
              />
              <p className="text-[10px] text-[#6b6b6b]">Detailed information shown on package detail pages</p>
            </div>

            <div className="space-y-2 rounded-xl border border-[#f2dfcf] bg-[#fff7f0] p-4">
              <label className="block text-xs font-semibold text-ink">Package Icon</label>
              <ImageUploadField
                label=""
                value={packageDraft.icon_url}
                onChange={(url) => setPackageDraftField('icon_url', url)}
                bucket="service-images"
                placeholder="Upload icon or enter URL"
              />
              <p className="text-[10px] text-[#6b6b6b]">Square icon (recommended: 200x200px) for package display</p>
            </div>

            <div className="space-y-2 rounded-xl border border-[#f2dfcf] bg-[#fff7f0] p-4">
              <label className="block text-xs font-semibold text-ink">Package Banner</label>
              <ImageUploadField
                label=""
                value={packageDraft.banner_image_url}
                onChange={(url) => setPackageDraftField('banner_image_url', url)}
                bucket="service-images"
                placeholder="Upload banner or enter URL"
              />
              <p className="text-[10px] text-[#6b6b6b]">Wide image (recommended: 1200x400px) for package header</p>
            </div>

            <div className="space-y-4 rounded-xl border border-[#f2dfcf] bg-[#fff7f0] p-4">
              <div>
                <p className="font-medium text-ink">Package Discount - Optional</p>
                <p className="text-xs text-[#6b6b6b]">Offer a discount on this package</p>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-ink mb-1">Discount Type</label>
                  <select
                    value={packageDraft.discount_type}
                    onChange={(event) =>
                      setPackageDraftField('discount_type', event.target.value as PackageDraft['discount_type'])
                    }
                    className="w-full rounded-xl border border-[#f2dfcf] px-3 py-2 text-xs"
                  >
                    <option value="">No Discount</option>
                    <option value="percentage">Percentage (%)</option>
                    <option value="fixed">Fixed Amount (₹)</option>
                  </select>
                  <p className="mt-1 text-[10px] text-[#6b6b6b]">Type of discount to apply</p>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-ink mb-1">Discount Value</label>
                  <input
                    value={packageDraft.discount_value}
                    onChange={(event) => setPackageDraftField('discount_value', event.target.value)}
                    placeholder={packageDraft.discount_type === 'percentage' ? 'e.g., 15' : 'e.g., 500'}
                    type="number"
                    step="0.01"
                    min="0"
                    disabled={!packageDraft.discount_type}
                    className="w-full rounded-xl border border-[#f2dfcf] px-3 py-2 text-xs disabled:bg-gray-100"
                  />
                  <p className="mt-1 text-[10px] text-[#6b6b6b]">{packageDraft.discount_type === 'percentage' ? '0-100%' : 'Amount in ₹'}</p>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-semibold text-ink">Display Order</label>
              <input
                value={packageDraft.display_order}
                onChange={(event) => setPackageDraftField('display_order', event.target.value)}
                placeholder="0 = first"
                type="number"
                min="0"
                className="w-full rounded-xl border border-[#f2dfcf] px-3 py-2 text-xs"
              />
              <p className="text-[10px] text-[#6b6b6b]">Position in package list (0 = first, lower numbers appear first)</p>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-semibold text-ink">Status & Visibility</p>
              <div className="flex flex-wrap gap-3">
                <label className="inline-flex items-center gap-2 rounded-xl border border-[#f2dfcf] px-3 py-2 text-xs hover:bg-[#fff7f0]">
                  <input
                    type="checkbox"
                    checked={packageDraft.is_featured}
                    onChange={(event) =>
                      setPackageDraftField('is_featured', event.target.checked)
                    }
                  />
                  <span>Featured</span>
                </label>
                <label className="inline-flex items-center gap-2 rounded-xl border border-[#f2dfcf] px-3 py-2 text-xs hover:bg-[#fff7f0]">
                  <input
                    type="checkbox"
                    checked={packageDraft.is_active}
                    onChange={(event) => setPackageDraftField('is_active', event.target.checked)}
                  />
                  <span>Active</span>
                </label>
              </div>
              <p className="text-[10px] text-[#6b6b6b]">Featured shows prominently · Active makes it visible to users</p>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={savePackage}
              disabled={isPending}
              className="rounded-full border border-[#f2dfcf] px-3 py-1.5 text-[11px] font-semibold text-ink"
            >
              {packageDraft.id ? 'Update Package' : 'Create Package'}
            </button>
            {packageDraft.id ? (
              <button
                type="button"
                onClick={resetPackageDraft}
                disabled={isPending}
                className="rounded-full border border-[#f2dfcf] px-3 py-1.5 text-[11px] font-semibold text-ink"
              >
                Clear Edit
              </button>
            ) : null}
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-[#f2dfcf] p-3">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-semibold text-ink">Existing Packages</p>
              <p className="text-[10px] text-[#6b6b6b]">Choose provider to preview package pricing and composition.</p>
            </div>
            <div className="w-full sm:w-72">
              <label className="mb-1 block text-[10px] font-semibold text-ink">Preview Provider</label>
              <select
                value={selectedProviderId}
                onChange={(event) => setSelectedProviderId(event.target.value)}
                className="w-full rounded-xl border border-[#f2dfcf] px-3 py-2 text-xs"
              >
                <option value="">Select Provider</option>
                {providers.map((provider) => (
                  <option key={provider.id} value={provider.id.toString()}>
                    {provider.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {packages.length === 0 ? (
            <p className="mt-2 text-xs text-[#6b6b6b]">No packages created yet.</p>
          ) : (
            <ul className="mt-2 grid gap-2">
              {packages.map((pkg) => (
                <li key={pkg.id} className="rounded-lg border border-[#f2dfcf] p-2 text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-medium text-ink">
                        {pkg.name}{' '}
                        {pkg.is_featured ? (
                          <span className="ml-1 text-[10px] text-[#6b6b6b]">★ Featured</span>
                        ) : null}
                      </p>
                      <p className="text-[11px] text-[#6b6b6b]">
                        {pkg.slug} • Order: {pkg.display_order}
                        {pkg.discount_type
                          ? ` • Discount: ${pkg.discount_type === 'percentage' ? `${pkg.discount_value}%` : `₹${pkg.discount_value}`}`
                          : ''}
                      </p>
                    </div>
                    <span
                      className={`rounded-full border border-[#f2dfcf] px-2.5 py-1 text-[11px] font-medium ${
                        pkg.is_active ? 'bg-[#fff7f0]' : 'bg-gray-100'
                      } text-ink`}
                    >
                      {pkg.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  {pkg.short_description ? (
                    <p className="mt-1 text-[11px] text-[#6b6b6b]">{pkg.short_description}</p>
                  ) : null}
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => loadPackageInDraft(pkg)}
                      disabled={isPending}
                      className="rounded-full border border-[#f2dfcf] px-2.5 py-1 text-[10px] font-semibold text-ink"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => viewPackageComposition(pkg)}
                      disabled={isPending}
                      className="rounded-full border border-[#f2dfcf] px-2.5 py-1 text-[10px] font-semibold text-ink"
                    >
                      View Composition
                    </button>
                    <button
                      type="button"
                      onClick={() => deletePackage(pkg.id)}
                      disabled={isPending}
                      className="rounded-full border border-[#f2dfcf] px-2.5 py-1 text-[10px] font-semibold text-ink"
                    >
                      Delete
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {selectedPackage && composition ? (
          <div className="mt-4 rounded-xl border border-[#f2dfcf] bg-[#fff7f0] p-4">
            <p className="text-sm font-semibold text-ink">
              Package Composition: {selectedPackage.name}
            </p>
            <div className="mt-2 space-y-2">
              {composition.services.map((item, index) => (
                <div key={index} className="rounded-lg border border-[#f2dfcf] bg-white p-2 text-xs">
                  <p className="font-medium text-ink">
                    {item.service.service_type}
                    {item.is_optional ? ' (Optional)' : ''}
                  </p>
                  <p className="text-[11px] text-[#6b6b6b]">
                    Base Price: ₹{item.service.base_price} • Order: {item.sequence_order}
                  </p>
                </div>
              ))}
              <div className="mt-3 rounded-lg border border-[#f2dfcf] bg-white p-2">
                <p className="text-xs font-semibold text-ink">Pricing Summary</p>
                <p className="mt-1 text-[11px] text-[#6b6b6b]">
                  Base Price: ₹{composition.totalBasePrice}
                </p>
                <p className="text-[11px] font-medium text-ink">
                  Final Price: ₹{composition.totalWithDiscount}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setSelectedPackage(null)}
              className="mt-3 rounded-full border border-[#f2dfcf] px-3 py-1.5 text-[11px] font-semibold text-ink"
            >
              Close
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
