'use client';

import { useState, useTransition } from 'react';
import { useToast } from '@/components/ui/ToastProvider';
import type { ServicePackage, ServiceCategory, PackageComposition } from '@/lib/service-catalog/types';

type PackageBuilderProps = {
  initialPackages: ServicePackage[];
  categories: ServiceCategory[];
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

export default function PackageBuilder({ initialPackages, categories }: PackageBuilderProps) {
  const [packages, setPackages] = useState<ServicePackage[]>(initialPackages);
  const [selectedPackage, setSelectedPackage] = useState<ServicePackage | null>(null);
  const [composition, setComposition] = useState<PackageComposition | null>(null);
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
    setSelectedPackage(pkg);
    setComposition(null);

    startTransition(async () => {
      try {
        // Use a sample provider ID for composition preview
        const response = await fetch(`/api/services/package/${pkg.id}?providerId=1`);
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
          <div className="mt-3 grid gap-2">
            <select
              value={packageDraft.category_id}
              onChange={(event) => setPackageDraftField('category_id', event.target.value)}
              className="rounded-xl border border-[#f2dfcf] px-3 py-2 text-xs"
            >
              <option value="">Select Category (Optional)</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
            <input
              value={packageDraft.name}
              onChange={(event) => setPackageDraftField('name', event.target.value)}
              placeholder="Package Name (e.g., Premium Grooming)"
              className="rounded-xl border border-[#f2dfcf] px-3 py-2 text-xs"
            />
            <input
              value={packageDraft.slug}
              onChange={(event) => setPackageDraftField('slug', event.target.value)}
              placeholder="Slug (e.g., premium-grooming)"
              className="rounded-xl border border-[#f2dfcf] px-3 py-2 text-xs"
            />
            <input
              value={packageDraft.short_description}
              onChange={(event) => setPackageDraftField('short_description', event.target.value)}
              placeholder="Short Description"
              className="rounded-xl border border-[#f2dfcf] px-3 py-2 text-xs"
            />
            <textarea
              value={packageDraft.full_description}
              onChange={(event) => setPackageDraftField('full_description', event.target.value)}
              placeholder="Full Description"
              rows={3}
              className="rounded-xl border border-[#f2dfcf] px-3 py-2 text-xs"
            />
            <input
              value={packageDraft.icon_url}
              onChange={(event) => setPackageDraftField('icon_url', event.target.value)}
              placeholder="Icon URL"
              className="rounded-xl border border-[#f2dfcf] px-3 py-2 text-xs"
            />
            <input
              value={packageDraft.banner_image_url}
              onChange={(event) => setPackageDraftField('banner_image_url', event.target.value)}
              placeholder="Banner Image URL"
              className="rounded-xl border border-[#f2dfcf] px-3 py-2 text-xs"
            />
            <div className="grid grid-cols-2 gap-2">
              <select
                value={packageDraft.discount_type}
                onChange={(event) =>
                  setPackageDraftField('discount_type', event.target.value as PackageDraft['discount_type'])
                }
                className="rounded-xl border border-[#f2dfcf] px-3 py-2 text-xs"
              >
                <option value="">No Discount</option>
                <option value="percentage">Percentage</option>
                <option value="fixed">Fixed Amount</option>
              </select>
              <input
                value={packageDraft.discount_value}
                onChange={(event) => setPackageDraftField('discount_value', event.target.value)}
                placeholder="Discount Value"
                type="number"
                step="0.01"
                disabled={!packageDraft.discount_type}
                className="rounded-xl border border-[#f2dfcf] px-3 py-2 text-xs"
              />
            </div>
            <input
              value={packageDraft.display_order}
              onChange={(event) => setPackageDraftField('display_order', event.target.value)}
              placeholder="Display Order (0 = first)"
              type="number"
              className="rounded-xl border border-[#f2dfcf] px-3 py-2 text-xs"
            />
            <div className="flex flex-wrap gap-3">
              <label className="inline-flex items-center gap-2 rounded-xl border border-[#f2dfcf] px-3 py-2 text-xs">
                <input
                  type="checkbox"
                  checked={packageDraft.is_featured}
                  onChange={(event) =>
                    setPackageDraftField('is_featured', event.target.checked)
                  }
                />
                Featured
              </label>
              <label className="inline-flex items-center gap-2 rounded-xl border border-[#f2dfcf] px-3 py-2 text-xs">
                <input
                  type="checkbox"
                  checked={packageDraft.is_active}
                  onChange={(event) => setPackageDraftField('is_active', event.target.checked)}
                />
                Active
              </label>
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
          <p className="text-xs font-semibold text-ink">Existing Packages</p>
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
