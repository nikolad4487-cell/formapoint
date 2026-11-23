import { describe, it, expect, vi } from 'vitest';
import { changeSharedPassword } from '../src/lib/password';
const user = { id: 'self', email: 'user@gmail.com', is_anonymous: false };
function auth() {
  return {
    getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }),
    signInWithPassword: vi.fn().mockResolvedValue({ data: { user }, error: null }),
    updateUser: vi.fn().mockResolvedValue({ data: { user }, error: null }),
  };
}
describe('shared password change', () => {
  it('accepts eight characters containing lower/uppercase letters and a digit and updates the verified FormaPoint user with current-password proof', async () => {
    const source = auth();
    await changeSharedPassword(source as never, 'self', 'old-password', 'Abcd1234');
    expect(source.signInWithPassword).toHaveBeenCalledWith({
      email: user.email,
      password: 'old-password',
    });
    expect(source.updateUser).toHaveBeenCalledWith({
      password: 'Abcd1234',
      current_password: 'old-password',
    });
  });
  it('rejects short or unchanged passwords before contacting auth', async () => {
    const source = auth();
    await expect(changeSharedPassword(source as never, 'self', 'old', '1234567')).rejects.toThrow(
      '8',
    );
    await expect(
      changeSharedPassword(source as never, 'self', 'Abcd1234', 'Abcd1234'),
    ).rejects.toThrow('drukčiju');
    await expect(changeSharedPassword(source as never, 'self', 'old', '87654321')).rejects.toThrow(
      'malo i veliko',
    );
    expect(source.getUser).not.toHaveBeenCalled();
  });
  it('never updates a guest or different user and rejects a wrong current password', async () => {
    const source = auth();
    source.getUser.mockResolvedValueOnce({
      data: { user: { ...user, id: 'someone-else' } },
      error: null,
    });
    await expect(changeSharedPassword(source as never, 'self', 'old', 'Zyxw9876')).rejects.toThrow(
      'ponovno',
    );
    source.getUser.mockResolvedValueOnce({
      data: { user: { ...user, is_anonymous: true } },
      error: null,
    });
    await expect(changeSharedPassword(source as never, 'self', 'old', 'Zyxw9876')).rejects.toThrow(
      'ponovno',
    );
    source.signInWithPassword.mockResolvedValueOnce({
      data: { user: null },
      error: { message: 'Invalid password' },
    });
    await expect(changeSharedPassword(source as never, 'self', 'old', 'Zyxw9876')).rejects.toThrow(
      'Trenutačna',
    );
    expect(source.updateUser).not.toHaveBeenCalled();
  });
  it('does not claim success when the provider rejects the password', async () => {
    const source = auth();
    source.updateUser.mockResolvedValueOnce({
      data: { user: null },
      error: { message: 'Private provider details' },
    });
    await expect(changeSharedPassword(source as never, 'self', 'old', 'Zyxw9876')).rejects.toThrow(
      'nije prihvaćena',
    );
  });
});
