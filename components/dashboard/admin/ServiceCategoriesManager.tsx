'use client';

import Image from 'next/image';
import { useState, useTransition } from 'react';
import { useToast } from '@/components/ui/ToastProvider';
import type { ServiceCategory } from '@/lib/service-catalog/types';

type ServiceCategoriesManagerProps = {
  initialCategories: ServiceCategory[];
};

type CategoryDraft = {
  id?: string;
  name: string;
  slug: string;
  description: string;
  icon_url: string;
  banner_image_url: string;
  display_order: string;
  is_featured: boolean;
  is_active: boolean;
};

export default function ServiceCategoriesManager({ initialCategories }: ServiceCategoriesManagerProps) {
  const [categories, setCategories] = useState<ServiceCategory[]>(initialCategories);
  const [isPending, startTransition] = useTransition();
  const { showToast } = useToast();
  const [categoryDraft, setCategoryDraft] = useState<CategoryDraft>({
    name: '',
    slug: '',
    description: '',
    icon_url: '',
    banner_image_url: '',
    display_order: '0',
    is_featured: false,
    is_active: true,
  });

  function setCategoryDraftField<K extends keyof CategoryDraft>(field: K, value: CategoryDraft[K]) {
    setCategoryDraft((current) => ({ ...current, [field]: value }));
  }

  function resetCategoryDraft() {
    setCategoryDraft({
      name: '',
      slug: '',
      description: '',
      icon_url: '',
      banner_image_url: '',
      display_order: '0',
      is_featured: false,
      is_active: true,
    });
  }

  function loadCategoryInDraft(category: ServiceCategory) {
    setCategoryDraft({
      id: category.id,
      name: category.name,
      slug: category.slug,
      description: category.description || '',
      icon_url: category.icon_url || '',
      banner_image_url: category.banner_image_url || '',
      display_order: category.display_order.toString(),
      is_featured: category.is_featured,
      is_active: category.is_active,
    });
  }

  function saveCategory() {
    if (!categoryDraft.name.trim() || !categoryDraft.slug.trim()) {
      showToast('Name and slug are required.', 'error');
      return;
    }

    startTransition(async () => {
      try {
        const payload = {
          name: categoryDraft.name.trim(),
          slug: categoryDraft.slug.trim().toLowerCase(),
          description: categoryDraft.description.trim() || null,
          icon_url: categoryDraft.icon_url.trim() || null,
          banner_image_url: categoryDraft.banner_image_url.trim() || null,
          display_order: parseInt(categoryDraft.display_order) || 0,
          is_featured: categoryDraft.is_featured,
          is_active: categoryDraft.is_active,
        };

        const url = categoryDraft.id
          ? `/api/admin/services/categories/${categoryDraft.id}`
          : '/api/admin/services/categories';

        const method = categoryDraft.id ? 'PUT' : 'POST';

        const response = await fetch(url, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || 'Failed to save category');
        }

        if (categoryDraft.id) {
          setCategories((current) =>
            current.map((cat) => (cat.id === categoryDraft.id ? result.data : cat))
          );
          showToast('Category updated successfully.', 'success');
        } else {
          setCategories((current) => [...current, result.data]);
          showToast('Category created successfully.', 'success');
        }

        resetCategoryDraft();
      } catch (error) {
        showToast(error instanceof Error ? error.message : 'Failed to save category', 'error');
      }
    });
  }

  function deleteCategory(categoryId: string) {
    if (!confirm('Are you sure you want to delete this category?')) {
      return;
    }

    startTransition(async () => {
      try {
        const response = await fetch(`/api/admin/services/categories/${categoryId}`, {
          method: 'DELETE',
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || 'Failed to delete category');
        }

        setCategories((current) => current.filter((cat) => cat.id !== categoryId));
        showToast('Category deleted successfully.', 'success');
      } catch (error) {
        showToast(error instanceof Error ? error.message : 'Failed to delete category', 'error');
      }
    });
  }

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-[#f2dfcf] bg-white p-6 shadow-soft-md">
        <h2 className="text-xl font-semibold text-ink">Service Categories</h2>
        <p className="mt-1 text-xs text-[#6b6b6b]">
          Organize services into categories for better user experience.
        </p>

        <div className="mt-4 rounded-xl border border-[#f2dfcf] p-4">
          <p className="text-sm font-semibold text-ink">
            {categoryDraft.id ? 'Edit Category' : 'Create New Category'}
          </p>
          <div className="mt-3 grid gap-2">
            <input
              value={categoryDraft.name}
              onChange={(event) => setCategoryDraftField('name', event.target.value)}
              placeholder="Category Name (e.g., Grooming)"
              className="rounded-xl border border-[#f2dfcf] px-3 py-2 text-xs"
            />
            <input
              value={categoryDraft.slug}
              onChange={(event) => setCategoryDraftField('slug', event.target.value)}
              placeholder="Slug (e.g., grooming)"
              className="rounded-xl border border-[#f2dfcf] px-3 py-2 text-xs"
            />
            <textarea
              value={categoryDraft.description}
              onChange={(event) => setCategoryDraftField('description', event.target.value)}
              placeholder="Description"
              rows={2}
              className="rounded-xl border border-[#f2dfcf] px-3 py-2 text-xs"
            />
            <input
              value={categoryDraft.icon_url}
              onChange={(event) => setCategoryDraftField('icon_url', event.target.value)}
              placeholder="Icon URL"
              className="rounded-xl border border-[#f2dfcf] px-3 py-2 text-xs"
            />
            <input
              value={categoryDraft.banner_image_url}
              onChange={(event) => setCategoryDraftField('banner_image_url', event.target.value)}
              placeholder="Banner Image URL"
              className="rounded-xl border border-[#f2dfcf] px-3 py-2 text-xs"
            />
            <input
              value={categoryDraft.display_order}
              onChange={(event) => setCategoryDraftField('display_order', event.target.value)}
              placeholder="Display Order (0 = first)"
              type="number"
              className="rounded-xl border border-[#f2dfcf] px-3 py-2 text-xs"
            />
            <div className="flex flex-wrap gap-3">
              <label className="inline-flex items-center gap-2 rounded-xl border border-[#f2dfcf] px-3 py-2 text-xs">
                <input
                  type="checkbox"
                  checked={categoryDraft.is_featured}
                  onChange={(event) =>
                    setCategoryDraftField('is_featured', event.target.checked)
                  }
                />
                Featured
              </label>
              <label className="inline-flex items-center gap-2 rounded-xl border border-[#f2dfcf] px-3 py-2 text-xs">
                <input
                  type="checkbox"
                  checked={categoryDraft.is_active}
                  onChange={(event) =>
                    setCategoryDraftField('is_active', event.target.checked)
                  }
                />
                Active
              </label>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={saveCategory}
              disabled={isPending}
              className="rounded-full border border-[#f2dfcf] px-3 py-1.5 text-[11px] font-semibold text-ink"
            >
              {categoryDraft.id ? 'Update Category' : 'Create Category'}
            </button>
            {categoryDraft.id ? (
              <button
                type="button"
                onClick={resetCategoryDraft}
                disabled={isPending}
                className="rounded-full border border-[#f2dfcf] px-3 py-1.5 text-[11px] font-semibold text-ink"
              >
                Clear Edit
              </button>
            ) : null}
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-[#f2dfcf] p-3">
          <p className="text-xs font-semibold text-ink">Existing Categories</p>
          {categories.length === 0 ? (
            <p className="mt-2 text-xs text-[#6b6b6b]">No categories created yet.</p>
          ) : (
            <ul className="mt-2 grid gap-2">
              {categories.map((category) => (
                <li
                  key={category.id}
                  className="rounded-lg border border-[#f2dfcf] p-2 text-xs"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {category.icon_url ? (
                        <Image
                          src={category.icon_url}
                          alt={category.name}
                          width={32}
                          height={32}
                          className="h-8 w-8 rounded-lg object-cover"
                        />
                      ) : null}
                      <div>
                        <p className="font-medium text-ink">
                          {category.name}{' '}
                          {category.is_featured ? (
                            <span className="ml-1 text-[10px] text-[#6b6b6b]">★ Featured</span>
                          ) : null}
                        </p>
                        <p className="text-[11px] text-[#6b6b6b]">
                          {category.slug} • Order: {category.display_order}
                        </p>
                      </div>
                    </div>
                    <span
                      className={`rounded-full border border-[#f2dfcf] px-2.5 py-1 text-[11px] font-medium ${
                        category.is_active ? 'bg-[#fff7f0]' : 'bg-gray-100'
                      } text-ink`}
                    >
                      {category.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  {category.description ? (
                    <p className="mt-1 text-[11px] text-[#6b6b6b]">{category.description}</p>
                  ) : null}
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => loadCategoryInDraft(category)}
                      disabled={isPending}
                      className="rounded-full border border-[#f2dfcf] px-2.5 py-1 text-[10px] font-semibold text-ink"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteCategory(category.id)}
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
      </div>
    </div>
  );
}
