import { Building2, LoaderCircle, Plus } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { WorkspaceHeader } from '@/features/workspace/workspace-header';
import {
  createOrganization,
  listOrganizations,
} from '@/features/organizations/organizations-api';
import type { PublicOrganization } from '@drawmyplace/contracts';
import { getErrorMessage } from '@/lib/api';

export function OrganizationsPage() {
  const [orgs, setOrgs] = useState<PublicOrganization[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      setOrgs(await listOrganizations());
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
    try {
      const created = await createOrganization({ name });
      setOrgs((current) => (current ? [created, ...current] : [created]));
      setName('');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="relative min-h-screen">
      <WorkspaceHeader badge="Organizations" />
      <main className="mx-auto max-w-6xl px-6 py-10">
        <Link
          to="/app"
          className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-white"
        >
          Back
        </Link>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-white">
          Organizations
        </h1>
        <form className="mt-6 flex gap-3" onSubmit={handleCreate}>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Organization name"
            required
          />
          <Button type="submit" disabled={creating}>
            <Plus className="h-4 w-4" />
            Create
          </Button>
        </form>
        {error ? (
          <p className="mt-4 text-sm text-rose-300">{error}</p>
        ) : null}
        {loading ? (
          <div className="mt-8 flex items-center gap-3 text-sm text-slate-400">
            <LoaderCircle className="h-5 w-5 animate-spin text-amber-300" />
            Loading…
          </div>
        ) : (
          <div className="mt-8 grid gap-4">
            {(orgs ?? []).map((org) => (
              <div
                key={org.id}
                className="rounded-2xl border border-white/10 bg-slate-900/60 p-5"
              >
                <div className="flex items-center gap-3">
                  <Building2 className="h-5 w-5 text-amber-300" />
                  <div>
                    <h2 className="font-semibold text-white">{org.name}</h2>
                    <p className="text-xs text-slate-500">{org.id}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}