const form = document.getElementById('pairForm');
const phoneEl = document.getElementById('phone');
const passEl = document.getElementById('password');
const resBox = document.getElementById('result');
const codeEl = document.getElementById('code');

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const phone = phoneEl.value.replace(/\s+/g, '');
  const password = passEl.value;
  if (!phone || !password) return;

  form.querySelector('button').disabled = true;
  form.querySelector('button').textContent = 'Generating...';

  try {
    const r = await fetch('/api/pair', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, password })
    });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error || 'Failed');
    codeEl.textContent = j.code + (j.lang ? ` — lang: ${j.lang}` : '');
    resBox.classList.remove('hidden');
  } catch (err) {
    alert(err.message || String(err));
  } finally {
    form.querySelector('button').disabled = false;
    form.querySelector('button').textContent = 'Get Pairing Code';
  }
});
