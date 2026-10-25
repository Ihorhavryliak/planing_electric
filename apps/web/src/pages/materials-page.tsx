import { LoaderCircle, Plus } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { WorkspaceHeader } from '@/features/workspace/workspace-header';
import {
  createMaterial,
  listMaterials,
  updateMaterial,
} from '@/features/editor/materials-api';
import type { PublicMaterial } from '@drawmyplace/contracts';
import { getErrorMessage } from '@/lib/api';

export function MaterialsPage() {
  const [materials, setMaterials] = useState<PublicMaterial[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [unit, setUnit] = useState('m');
  const [category, setCategory] =
    useState<'cable' | 'conduit' | 'accessory' | 'other'>('cable');
  const [price, setPrice] = useState('');
  const [creating, setCreating] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      setMaterials(await listMaterials());
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreating(true);
    setError(null);
    try {
      const created = await createMaterial({
        code,
        name,
        unit,
        category,
        unitPrice: price === '' ? null : Number(price),
      });
      setMaterials((current) => [...current, created]);
      setCode('');
      setName('');
      setPrice('');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setCreating(false);
    }
  }

  async function handlePrice(material: PublicMaterial, value: string) {
    try {
      const updated = await updateMaterial(material.id, {
        unitPrice: value === '' ? null : Number(value),
      });
      if (updated) {
        setMaterials((current) =>
          current.map((item) => (item.id === updated.id ? updated : item)),
        );
      }
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  async function handleToggle(material: PublicMaterial) {
    try {
      const updated = await updateMaterial(material.id, {
        active: !material.active,
      });
      if (updated) {
        setMaterials((current) =>
          current.map((item) => (item.id === updated.id ? updated : item)),
        );
      }
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  return (
    <div className="relative min-h-screen">
      <WorkspaceHeader badge="Materials" />
      <main id="main-content" className="mx-auto max-w-5xl px-6 py-10">
        <Link
          to="/app"
          className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-white"
        >
          Back
        </Link>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-white">
          Material catalog
        </h1>
        <p className="mt-2 text-sm text-slate-400">
          Cables and installation materials used by estimates.
        </p>

        <form
          className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-6"
          onSubmit={handleCreate}
        >
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Code"
            required
          />
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name"
            required
            className="lg:col-span-2"
          />
          <Input
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            placeholder="Unit"
            required
          />
          <select
            value={category}
            onChange={(e) =>
              setCategory(e.target.value as typeof category)
            }
            className="h-10 rounded-lg border border-white/10 bg-slate-950 px-3 text-sm text-slate-200"
          >
            <option value="cable">Cable</option>
            <option value="conduit">Conduit</option>
            <option value="accessory">Accessory</option>
            <option value="other">Other</option>
          </select>
          <Input
            type="number"
            min="0"
            step="0.01"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="Price"
          />
          <Button type="submit" disabled={creating} className="lg:col-span-6">
            <Plus className="h-4 w-4" />
            Add material
          </Button>
        </form>

        {error ? (
          <p role="alert" className="mt-4 text-sm text-rose-300">
            {error}
          </p>
        ) : null}

        {loading ? (
          <div className="mt-8 flex items-center gap-3 text-sm text-slate-400">
            <LoaderCircle className="h-5 w-5 animate-spin text-amber-300" />
            Loading…
          </div>
        ) : (
          <div className="mt-8 overflow-x-auto rounded-2xl border border-white/10">
            <table className="w-full text-sm">
              <thead className="bg-white/5 text-left text-xs text-slate-400">
                <tr>
                  <th className="px-4 py-3">Code</th>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Unit</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Price</th>
                  <th className="px-4 py-3">Active</th>
                </tr>
              </thead>
              <tbody>
                {materials.map((material) => (
                  <tr key={material.id} className="border-t border-white/5">
                    <td className="px-4 py-2 text-slate-300">{material.code}</td>
                    <td className="px-4 py-2 text-slate-200">{material.name}</td>
                    <td className="px-4 py-2 text-slate-400">{material.unit}</td>
                    <td className="px-4 py-2 text-slate-400">
                      {material.category ?? '—'}
                    </td>
                    <td className="px-4 py-2">
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        defaultValue={material.unitPrice ?? ''}
                        className="h-8 w-24"
                        onBlur={(event) =>
                          void handlePrice(material, event.target.value)
                        }
                      />
                    </td>
                    <td className="px-4 py-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => void handleToggle(material)}
                      >
                        {material.active ? 'Active' : 'Inactive'}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}