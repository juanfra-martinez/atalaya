"""web/build.py: la configuración de las cuentas opcionales (Supabase) que se incrusta en la web publicada."""
import base64
import importlib.util
import json
from pathlib import Path

import pytest

WEB = Path(__file__).resolve().parents[2] / "web"
_spec = importlib.util.spec_from_file_location("atalaya_web_build", WEB / "build.py")
build = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(build)

URL = "https://abcdefghijklmnop.supabase.co"


def _jwt(role):
    part = base64.urlsafe_b64encode(json.dumps({"iss": "supabase", "role": role}).encode()).decode().rstrip("=")
    return f"eyJhbGciOiJIUzI1NiJ9.{part}.firma"


def test_sin_proyecto_no_hay_cuentas():
    assert build.supabase_config(None, None) is None
    assert build.supabase_config("", "  ") is None


def test_clave_publica_anon_y_publishable():
    cfg = build.supabase_config(URL + "/", _jwt("anon"), "discord, google", "UE (Fráncfort)", "privacidad@example.com")
    assert cfg == {"url": URL, "key": _jwt("anon"), "providers": ["discord"], "region": "UE (Fráncfort)", "contact": "privacidad@example.com"}
    assert build.supabase_config(URL, "sb_publishable_abc123")["providers"] == []


@pytest.mark.parametrize("url,key", [
    (URL, _jwt("service_role")),          # la clave de servicio salta la seguridad por filas: nunca en el HTML
    (URL, "sb_secret_abc123"),
    (URL, "loquesea"),
    ("http://abcdefghijklmnop.supabase.co", "sb_publishable_abc"),
    (URL, ""),
    ("", "sb_publishable_abc"),
])
def test_rechaza_claves_secretas_y_datos_incompletos(url, key):
    with pytest.raises(SystemExit):
        build.supabase_config(url, key)


def test_la_configuracion_va_en_el_html_y_no_en_la_demo(tmp_path):
    cfg = build.supabase_config(URL, "sb_publishable_abc")
    html = build.build(None, tmp_path / "site.html", "data", cfg).read_text(encoding="utf-8")
    assert 'window.ATALAYA_SUPABASE={"url": "https://abcdefghijklmnop.supabase.co"' in html
    assert "A.sync = {" in html
    plain = build.build(None, tmp_path / "plain.html", "data").read_text(encoding="utf-8")
    assert "window.ATALAYA_SUPABASE={" not in plain
    demo = tmp_path / "demo.json"
    demo.write_text("{}", encoding="utf-8")
    assert "window.ATALAYA_SUPABASE={" not in build.build(demo, tmp_path / "demo.html", None, cfg).read_text(encoding="utf-8")
