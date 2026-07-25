/* eslint-disable */
import { Container } from '@/components/layout/Container';
import { Section } from '@/components/layout/Section';
import { Button } from '@/components/ui/button';
import { updateUserRoleAction } from '../actions';
import { AdminQueryError } from '../_lib/query-error';
import { listAdminUsers } from '@/lib/data/admin-users';

export default async function AdminUsersPage() {
  const { users, error } = await listAdminUsers({ limit: 50 });

  if (error) {
    console.error('[admin/users] query failed:', error);
    return (
      <Section>
        <Container>
          <AdminQueryError title="Users Management" />
        </Container>
      </Section>
    );
  }

  return (
    <Section>
      <Container>
        <h1 className="mb-8 text-3xl font-bold">Users Management</h1>

        <div className="space-y-4">
          {users && users.length > 0 ? (
            <div className="overflow-hidden rounded-lg border border-border">
              <table className="w-full">
                <thead className="bg-muted">
                  <tr>
                    <th className="px-4 py-3 text-left">Email</th>
                    <th className="px-4 py-3 text-left">Name</th>
                    <th className="px-4 py-3 text-left">Role</th>
                    <th className="px-4 py-3 text-left">Tier</th>
                    <th className="px-4 py-3 text-left">Joined</th>
                    <th className="px-4 py-3 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id} className="border-t border-border">
                      <td className="px-4 py-3">{user.email}</td>
                      <td className="px-4 py-3">{user.full_name || 'N/A'}</td>
                      <td className="px-4 py-3">
                        <span className="rounded bg-primary/20 px-2 py-1 text-xs text-primary">
                          {user.role}
                        </span>
                      </td>
                      <td className="px-4 py-3">{user.subscription_tier}</td>
                      <td className="px-4 py-3">
                        {new Date(user.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3">
                        <form action={updateUserRoleAction} className="flex items-center gap-2">
                          <input type="hidden" name="profileId" value={user.id} />
                          <select
                            name="role"
                            defaultValue={user.role}
                            className="h-9 rounded-md border border-input bg-background px-2 py-1 text-sm"
                            aria-label={`Role for ${user.email}`}
                          >
                            <option value="reader">Reader</option>
                            <option value="author">Author</option>
                            <option value="partner">Partner</option>
                            <option value="admin">Admin</option>
                          </select>
                          <Button type="submit" variant="outline" size="sm">
                            Save
                          </Button>
                        </form>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-secondary">No users found</p>
          )}
        </div>
      </Container>
    </Section>
  );
}
