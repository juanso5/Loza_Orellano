ALTER TABLE users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_select_self" ON users
  FOR SELECT USING (id = auth.uid());
CREATE POLICY "users_insert_self" ON users
  FOR INSERT WITH CHECK (id = auth.uid());
CREATE POLICY "users_update_self" ON users
  FOR UPDATE USING (id = auth.uid()) WITH CHECK (id = auth.uid());

ALTER TABLE carteras ENABLE ROW LEVEL SECURITY;
CREATE POLICY "carteras_user" ON carteras
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

ALTER TABLE movimientos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "movimientos_user" ON movimientos
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
