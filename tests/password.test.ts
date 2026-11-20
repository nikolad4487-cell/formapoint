import {describe,it,expect,vi} from 'vitest';
import {changeSharedPassword} from '../src/lib/password';
const user={id:'self',email:'user@gmail.com',is_anonymous:false};
function auth(){return {getUser:vi.fn().mockResolvedValue({data:{user},error:null}),signInWithPassword:vi.fn().mockResolvedValue({data:{user},error:null}),updateUser:vi.fn().mockResolvedValue({data:{user},error:null})};}
describe('shared password change',()=>{
 it('accepts eight digits and updates the verified FormaPoint user with current-password proof',async()=>{
  const source=auth();await changeSharedPassword(source as never,'self','old-password','12349876');
  expect(source.signInWithPassword).toHaveBeenCalledWith({email:user.email,password:'old-password'});
  expect(source.updateUser).toHaveBeenCalledWith({password:'12349876',current_password:'old-password'});
 });
 it('rejects short or unchanged passwords before contacting auth',async()=>{
  const source=auth();await expect(changeSharedPassword(source as never,'self','old','1234567')).rejects.toThrow('8');
  await expect(changeSharedPassword(source as never,'self','12345678','12345678')).rejects.toThrow('drukčiju');
  expect(source.getUser).not.toHaveBeenCalled();
 });
 it('never updates a guest or different user and rejects a wrong current password',async()=>{
  const source=auth();source.getUser.mockResolvedValueOnce({data:{user:{...user,id:'someone-else'}},error:null});
  await expect(changeSharedPassword(source as never,'self','old','87654321')).rejects.toThrow('ponovno');
  source.getUser.mockResolvedValueOnce({data:{user:{...user,is_anonymous:true}},error:null});
  await expect(changeSharedPassword(source as never,'self','old','87654321')).rejects.toThrow('ponovno');
  source.signInWithPassword.mockResolvedValueOnce({data:{user:null},error:{message:'Invalid password'}});
  await expect(changeSharedPassword(source as never,'self','old','87654321')).rejects.toThrow('Trenutačna');
  expect(source.updateUser).not.toHaveBeenCalled();
 });
 it('does not claim success when the provider rejects the password',async()=>{
  const source=auth();source.updateUser.mockResolvedValueOnce({data:{user:null},error:{message:'Private provider details'}});
  await expect(changeSharedPassword(source as never,'self','old','87654321')).rejects.toThrow('nije prihvaćena');
 });
});
