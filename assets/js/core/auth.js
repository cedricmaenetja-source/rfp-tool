const AUTH_USER = {
  user: "admin",
  password: "955453edda726f62efc7e35a612b007d5e65266c2cbf7a5909cf166e14990e0f"
};

export async function auth(user, pwd){
    const password = await sha256(pwd);
    if (user == AUTH_USER.user && password ==  AUTH_USER.password){
        setCookie('loggedIn', true);
        return true;
    }

    return false;
}

async function sha256(text) {
  const data = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(hashBuffer)]
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

export function isUserLoggedIn(){
    const loggedIn = getCookie('loggedIn');
    return (loggedIn) ? true : false;
}

export function setCookie(name, value, days = 1) {
  const date = new Date();
  date.setTime(date.getTime() + days * 86400000);

  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${date.toUTCString()}; path=/; SameSite=Lax`;
}

export function getCookie(name) {
  return document.cookie
    .split('; ')
    .find(row => row.startsWith(name + '='))
    ?.split('=')[1];
}