import {
  Building2,
  LoaderCircle,
  Plus,
  Trash2,
  Users,
} from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useI18n } from '@/features/i18n/i18n-context';
import { WorkspaceHeader } from '@/features/workspace/workspace-header';
import {
  createInvitation,
  createOrganization,
  listInvitations,
  listOrganizationMembers,
  listOrganizations,
  revokeInvitation,
} from '@/features/organizations/organizations-api';
import type {
  OrganizationRole,
  PublicInvitation,
  PublicOrganization,
  PublicOrganizationMember,
} from '@drawmyplace/contracts';
import { getErrorMessage } from '@/lib/api';

export function OrganizationsPage() {
  const { t } = useI18n();
  const [orgs, setOrgs] = useState<PublicOrganization[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [members, setMembers] = useState<PublicOrganizationMember[]>([]);
  const [invitations, setInvitations] = useState<PublicInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);

  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<OrganizationRole>('viewer');
  const [inviting, setInviting] = useState(false);
  const [inviteToken, setInviteToken] = useState<string | null>(null);

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

  useEffect(() => {
    if (!selected) return;
    let cancelled = false;
    void (async () => {
      try {
        const [memberList, invitationList] = await Promise.all([
          listOrganizationMembers(selected),
          listInvitations(selected),
        ]);
        if (!cancelled) {
          setMembers(memberList ?? []);
          setInvitations(invitationList ?? []);
        }
      } catch (err) {
        if (!cancelled) setError(getErrorMessage(err));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selected]);

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreating(true);
    try {
      const created = await createOrganization({ name });
      setOrgs((current) => (current ? [created, ...current] : [created]));
      setName('');
      setSelected(created.id);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setCreating(false);
    }
  }

  async function handleInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    setInviting(true);
    setInviteToken(null);
    try {
      const result = await createInvitation(selected, {
        email: inviteEmail,
        role: inviteRole,
        expiresInDays: 7,
      });
      setInvitations((current) => [result.invitation, ...current]);
      setInviteToken(result.token ?? null);
      setInviteEmail('');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setInviting(false);
    }
  }

  async function handleRevoke(id: string) {
    try {
      await revokeInvitation(id);
      setInvitations((current) =>
        current.map((item) =>
          item.id === id
            ? { ...item, revokedAt: new Date().toISOString() }
            : item,
        ),
      );
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  return (
    <div className="relative min-h-screen">
      <WorkspaceHeader badge={t('org.badge')} />
      <main id="main-content" className="mx-auto max-w-6xl px-6 py-10">
        <Link
          to="/app"
          className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-white"
        >
          {t('org.back')}
        </Link>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-white">
          {t('org.title')}
        </h1>
        <form className="mt-6 flex gap-3" onSubmit={handleCreate}>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('org.namePlaceholder')}
            required
          />
          <Button type="submit" disabled={creating}>
            <Plus className="h-4 w-4" />
            {t('org.create')}
          </Button>
        </form>
        {error ? <p className="mt-4 text-sm text-rose-300">{error}</p> : null}

        <div className="mt-8 grid gap-6 lg:grid-cols-[18rem_minmax(0,1fr)]">
          <section className="space-y-2">
            {loading ? (
              <div className="flex items-center gap-3 text-sm text-slate-400">
                <LoaderCircle className="h-5 w-5 animate-spin text-amber-300" />
                {t('org.loading')}
              </div>
            ) : (orgs ?? []).length === 0 ? (
              <p className="text-sm text-slate-500">{t('org.empty')}</p>
            ) : (
              (orgs ?? []).map((org) => (
                <button
                  key={org.id}
                  type="button"
                  onClick={() => setSelected(org.id)}
                  className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2 text-left ${
                    selected === org.id
                      ? 'border-amber-400/30 bg-amber-400/10'
                      : 'border-white/10 bg-slate-900/60 hover:bg-white/5'
                  }`}
                >
                  <Building2 className="h-4 w-4 text-amber-300" />
                  <span className="truncate text-sm text-white">{org.name}</span>
                </button>
              ))
            )}
          </section>

          <section className="app-panel p-5">
            {!selected ? (
              <p className="text-sm text-slate-500">
                {t('org.selectHint')}
              </p>
            ) : (
              <>
                <h2 className="flex items-center gap-2 text-sm font-semibold text-white">
                  <Users className="h-4 w-4 text-amber-300" />
                  {t('org.members')}
                </h2>
                <ul className="mt-3 space-y-2">
                  {members.map((member) => (
                    <li
                      key={member.id}
                      className="flex items-center justify-between gap-3 rounded-lg border border-white/5 px-3 py-2 text-sm"
                    >
                      <span className="text-slate-300">{member.userId}</span>
                      <span className="text-xs text-amber-300">
                        {t(`role.${member.role}`)} · {member.status}
                      </span>
                    </li>
                  ))}
                </ul>

                <h2 className="mt-6 text-sm font-semibold text-white">
                  {t('org.invitations')}
                </h2>
                <form className="mt-3 flex flex-wrap gap-2" onSubmit={handleInvite}>
                  <Input
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="member@example.com"
                    required
                    className="min-w-56 flex-1"
                  />
                  <select
                    value={inviteRole}
                    onChange={(e) =>
                      setInviteRole(e.target.value as OrganizationRole)
                    }
                    className="h-10 rounded-lg border border-white/10 bg-slate-950 px-3 text-sm text-slate-200"
                  >
                    <option value="viewer">{t('role.viewer')}</option>
                    <option value="electrician">{t('role.electrician')}</option>
                    <option value="manager">{t('role.manager')}</option>
                    <option value="admin">{t('role.admin')}</option>
                  </select>
                  <Button type="submit" disabled={inviting}>
                    {inviting ? t('org.inviting') : t('org.invite')}
                  </Button>
                </form>

                {inviteToken ? (
                  <div className="mt-3 rounded-lg border border-emerald-400/20 bg-emerald-400/10 px-3 py-2 text-xs text-emerald-100">
                    {t('org.tokenHint')}
                    <code className="mt-1 block break-all text-emerald-200">
                      {inviteToken}
                    </code>
                  </div>
                ) : null}

                <ul className="mt-4 space-y-2">
                  {invitations.map((invitation) => (
                    <li
                      key={invitation.id}
                      className="flex items-center justify-between gap-3 rounded-lg border border-white/5 px-3 py-2 text-sm"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-slate-300">
                          {invitation.email}
                        </span>
                        <span className="text-xs text-slate-500">
                          {t(`role.${invitation.role}`)} ·{' '}
                          {invitation.revokedAt
                            ? t('org.revoked')
                            : invitation.acceptedAt
                              ? t('org.accepted')
                              : t('org.pending')}
                        </span>
                      </span>
                      {!invitation.revokedAt && !invitation.acceptedAt ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => void handleRevoke(invitation.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                          {t('org.revoke')}
                        </Button>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}