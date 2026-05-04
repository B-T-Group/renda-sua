"""Agent proximity emails via Resend transactional templates."""

from __future__ import annotations

import os
from datetime import datetime
from typing import Dict, List, Optional

from rendasua_core_packages.models import AgentLocation, Order
from rendasua_core_packages.secrets_manager import get_resend_api_key
from rendasua_core_packages.utilities import format_full_address

from .nest_sms_client import send_sms_via_nest_api
from .resend_client import send_resend_template_email

_SMS_BODY_MAX = 480


def log_info(message: str, **kwargs: object) -> None:
    ctx = " ".join(f"{k}={v}" for k, v in kwargs.items())
    print(f"[INFO] [agent_proximity] {message}" + (f" | {ctx}" if ctx else ""))


def log_error(message: str, error: Exception | None = None, **kwargs: object) -> None:
    ctx = " ".join(f"{k}={v}" for k, v in kwargs.items())
    err = f" | error={error}" if error else ""
    print(f"[ERROR] [agent_proximity] {message}" + (f" | {ctx}" if ctx else "") + err)


def _normalize_language(lang: Optional[str]) -> str:
    if not lang or not str(lang).strip():
        return "fr"
    return "fr" if str(lang).lower().startswith("fr") else "en"


def _distance_label(distance_km: float, locale: str) -> str:
    if distance_km < 1:
        meters = distance_km * 1000
        return f"{meters:.0f} m" if locale == "fr" else f"{meters:.0f} m"
    return f"{distance_km:.1f} km"


def _proximity_message(distance_str: str, locale: str) -> str:
    if locale == "fr":
        return (
            f"Une nouvelle commande est disponible à environ {distance_str} "
            "de votre position. Ouvrez l’application Rendasua pour plus de détails."
        )
    return (
        f"A new order is available about {distance_str} from your location. "
        "Open the Rendasua app for details."
    )


def _aggregated_message(order_count: int, radius_str: str, locale: str) -> str:
    if locale == "fr":
        return (
            f"Vous avez {order_count} commande(s) à proximité dans un rayon "
            f"d’environ {radius_str}. Ouvrez l’application Rendasua pour les consulter."
        )
    return (
        f"You have {order_count} order(s) nearby within about {radius_str}. "
        "Open the Rendasua app to view them."
    )


def _pick_template_id(locale: str, en_id: str, fr_id: str) -> str:
    en = (en_id or "").strip()
    fr = (fr_id or "").strip()
    if locale == "fr" and fr:
        return fr
    if en:
        return en
    return fr


def _from_email() -> str:
    return os.environ.get("RESEND_FROM_EMAIL", "Rendasua <noreply@rendasua.com>")


def send_proximity_notification(
    agent_location: AgentLocation,
    order: Order,
    distance_km: float,
    resend_api_key: str,
    template_id_en: str,
    template_id_fr: str,
) -> bool:
    log_info(
        "Preparing proximity notification",
        agent_id=agent_location.agent_id,
        order_id=order.id,
        distance_km=round(distance_km, 2),
    )
    agent_user = agent_location.agent.user if agent_location.agent else None
    if not agent_user:
        log_error("Agent user missing", agent_id=agent_location.agent_id)
        return False
    agent_email = (agent_user.email or "").strip() if agent_user.email else ""
    agent_phone = (getattr(agent_user, "phone_number", None) or "").strip()
    locale = _normalize_language(getattr(agent_user, "preferred_language", None))
    distance_str = _distance_label(distance_km, locale)

    if agent_email:
        if not resend_api_key or not (
            (template_id_en or "").strip() or (template_id_fr or "").strip()
        ):
            log_error("Resend API key or proximity template id missing")
            return False
        agent_name = f"{agent_user.first_name} {agent_user.last_name}".strip() or "Agent"
        tid = _pick_template_id(locale, template_id_en, template_id_fr)
        bl = order.business_location
        business_name = bl.name if bl else "N/A"
        if bl and bl.address:
            try:
                business_address = format_full_address(bl.address)
            except (AttributeError, KeyError):
                business_address = "NA"
        else:
            business_address = "NA"
        variables = {
            "recipientName": agent_name,
            "message": _proximity_message(distance_str, locale),
            "orderNumber": order.order_number,
            "orderId": order.id,
            "businessName": business_name,
            "businessAddress": business_address,
            "currentYear": datetime.now().year,
        }
        ok, err = send_resend_template_email(
            resend_api_key,
            _from_email(),
            agent_email,
            tid,
            variables,
        )
        if ok:
            log_info("Proximity email sent", agent_email=agent_email)
            return True
        log_error("Resend proximity send failed", error=None, detail=err)
        return False

    if agent_phone:
        body = (f"Rendasua — {_proximity_message(distance_str, locale)}")[:_SMS_BODY_MAX]
        ok, err = send_sms_via_nest_api(agent_phone, body)
        if ok:
            log_info("Proximity SMS sent via Nest", agent_id=agent_location.agent_id)
            return True
        log_error("Proximity SMS via Nest failed", error=None, detail=err)
        return False

    log_error("No agent email or phone", agent_id=agent_location.agent_id)
    return False


def send_notifications_to_nearby_agents(
    agent_locations: List[AgentLocation],
    order: Order,
    distances: List[float],
    environment: str,
    template_id_en: str,
    template_id_fr: str,
) -> int:
    log_info(
        "Batch proximity send",
        total=len(agent_locations),
        order_id=order.id,
    )
    api_key = get_resend_api_key(environment) or ""
    if not api_key:
        log_info(
            "Resend API key not available — email sends skipped; SMS-only agents may still notify",
            environment=environment,
        )
    sent = 0
    for agent_location, dist in zip(agent_locations, distances):
        if send_proximity_notification(
            agent_location,
            order,
            dist,
            api_key,
            template_id_en,
            template_id_fr,
        ):
            sent += 1
    log_info("Batch complete", sent=sent, total=len(agent_locations))
    print(f"Sent {sent} out of {len(agent_locations)} notifications")
    return sent


def send_aggregated_proximity_notification(
    agent_location: AgentLocation,
    order_count: int,
    proximity_radius_km: float,
    resend_api_key: str,
    template_id_en: str,
    template_id_fr: str,
) -> bool:
    if not (template_id_en or template_id_fr):
        log_error("Summary template ids missing")
        return False
    agent_user = agent_location.agent.user if agent_location.agent else None
    if not agent_user:
        log_error("Agent user missing", agent_id=agent_location.agent_id)
        return False
    agent_email = (agent_user.email or "").strip() if agent_user.email else ""
    agent_phone = (getattr(agent_user, "phone_number", None) or "").strip()
    locale = _normalize_language(getattr(agent_user, "preferred_language", None))
    if proximity_radius_km < 1:
        radius_str = f"{proximity_radius_km * 1000:.0f} m"
    else:
        radius_str = f"{proximity_radius_km:.0f} km"
    agg_line = _aggregated_message(order_count, radius_str, locale)

    if agent_email:
        if not resend_api_key:
            log_error("Resend key missing for aggregated email")
            return False
        tid = _pick_template_id(locale, template_id_en, template_id_fr)
        agent_name = f"{agent_user.first_name} {agent_user.last_name}".strip() or "Agent"
        variables = {
            "recipientName": agent_name,
            "message": agg_line,
            "currentYear": datetime.now().year,
        }
        ok, err = send_resend_template_email(
            resend_api_key,
            _from_email(),
            agent_email,
            tid,
            variables,
        )
        if ok:
            return True
        log_error("Aggregated send failed", error=None, detail=err)
        return False

    if agent_phone:
        body = (f"Rendasua — {agg_line}")[:_SMS_BODY_MAX]
        ok, err = send_sms_via_nest_api(agent_phone, body)
        if ok:
            log_info("Aggregated proximity SMS sent via Nest", agent_id=agent_location.agent_id)
            return True
        log_error("Aggregated SMS via Nest failed", error=None, detail=err)
        return False

    log_error("No agent email or phone", agent_id=agent_location.agent_id)
    return False


def send_aggregated_notifications_to_agents(
    agent_locations: List[AgentLocation],
    agent_order_counts: Dict[str, int],
    proximity_radius_km: float,
    environment: str,
    template_id_en: str,
    template_id_fr: str,
) -> int:
    log_info("Aggregated batch", agents=len(agent_locations))
    api_key = get_resend_api_key(environment) or ""
    if not api_key:
        log_info(
            "Resend API key not available — aggregated emails skipped; SMS-only agents may still notify",
            environment=environment,
        )
    if not template_id_en and not template_id_fr:
        log_error("Summary template ids not configured; skipping aggregated sends")
        return 0
    sent = 0
    for loc in agent_locations:
        count = agent_order_counts.get(loc.agent_id, 0)
        if count == 0:
            continue
        if send_aggregated_proximity_notification(
            loc,
            count,
            proximity_radius_km,
            api_key,
            template_id_en,
            template_id_fr,
        ):
            sent += 1
    print(f"Sent {sent} out of {len(agent_locations)} aggregated notifications")
    return sent
