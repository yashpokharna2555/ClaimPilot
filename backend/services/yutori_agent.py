"""
Yutori browser-automation integration via the official Yutori Python SDK.
SDK:  pip install yutori
MCP:  uvx yutori-mcp  (configured in .mcp.json for Claude Code tooling)
"""

import uuid

from yutori import AsyncYutoriClient

from config import settings
from models.claim_json import ClaimJSON
from models.evidence import EvidenceBundle


def build_task_description(
    claim: ClaimJSON,
    bundle: EvidenceBundle,
    base_url: str,
    incident_date: str,
) -> str:
    """
    Build a natural language task description for the Yutori Browsing API.
    Yutori logs into InsureCo, navigates to the claim form, fills it, uploads
    evidence clip URLs, and returns the confirmation number + insure_co_claim_id.
    """
    dm = claim.damage_map
    vi = claim.vehicle_identity
    hz = claim.hazards

    damage_summary = ", ".join(dm.damage_zones) if dm.damage_zones else "vehicle damage"
    damage_detail = (
        f"Damage zones: {damage_summary}. "
        f"Types: {', '.join(dm.damage_types) if dm.damage_types else 'not specified'}. "
        f"Severity: {dm.severity}. "
        f"Drivable: {hz.drivable}."
    )

    make_model = vi.make_model_guess or "Unknown vehicle"

    def checkbox_action(val: bool) -> str:
        return "check" if val else "leave unchecked"

    drivability = "yes" if hz.drivable else "no"

    # Build evidence upload steps
    evidence_steps = ""
    if bundle.clips:
        evidence_lines = "\n".join(
            f"         {clip.clip_url} → label: \"{clip.clip_type}\""
            for clip in bundle.clips
            if clip.clip_url
        )
        if evidence_lines:
            evidence_steps = (
                f"Step 9: Navigate to {{insure_co_url}}/claims/{{UUID}}\n"
                f"Step 10: In the \"Evidence / Proofs\" section, for each clip URL below, enter the URL\n"
                f"         in the #evidence-url-input field, enter the label in #evidence-label-input,\n"
                f"         and click #add-evidence-btn:\n"
                f"{evidence_lines}\n"
            )

    task = (
        f"Step 1: Navigate to {base_url}/login\n"
        f"Step 2: Fill the login form — Email field: 'demo@insureco.com', Password field: 'Demo1234!' — then click the Sign In button.\n"
        f"Step 3: After login succeeds and the dashboard loads, navigate to {base_url}/claims/new\n"
        f"Step 4: Fill the claim form using the following field IDs and values:\n"
        f"  - #policyholder-name → 'Demo User'\n"
        f"  - #policyholder-email → 'claims@swiftsettle.com'\n"
        f"  - #policyholder-phone → '555-0100'\n"
        f"  - #incident-date → '{incident_date}'\n"
        f"  - #vehicle-info → '{make_model}'\n"
        f"  - #incident-type → select the option closest to '{getattr(dm, 'incident_type', 'other')}'\n"
        f"  - #damage-description → '{damage_detail}'\n"
        f"  - #vin-visible → {checkbox_action(vi.vin_visible)}\n"
        f"  - #plate-visible → {checkbox_action(vi.plate_visible)}\n"
        f"  - #airbag-deployed → {checkbox_action(hz.airbag_deployed)}\n"
        f"  - #warning-lights → {checkbox_action(hz.warning_lights_present)}\n"
        f"  - #drivability → select '{drivability}'\n"
        f"Step 5: Click the Submit Claim button.\n"
        f"Step 6: On the confirmation page, read the confirmation number displayed in the element "
        f"with id 'confirmation-number'. It will be in the format CLM-XXXXXXXX.\n"
        f"Step 7: Read the claim UUID from the current URL "
        f"(the path will be /claims/{{UUID}}/confirmation). This UUID is the insure_co_claim_id.\n"
        f"Step 8: Navigate to {base_url}/claims/{{UUID}} (substitute the actual UUID).\n"
    )

    if evidence_steps:
        task += evidence_steps.replace("{insure_co_url}", base_url).replace("{UUID}", "{the actual UUID}")

    task += "Step 11: Return both the confirmation_number AND the insure_co_claim_id (UUID from URL)."

    return task


async def create_yutori_task(task_description: str, start_url: str | None = None) -> str:
    """
    Create a Yutori Browsing API task via the official async SDK.
    Uses require_auth=True to enable the auth-optimised browser for login flows.
    Returns: yutori task_id
    """
    async with AsyncYutoriClient(api_key=settings.yutori_api_key) as client:
        result = await client.browsing.create(
            task=task_description,
            start_url=start_url or f"{settings.insurance_portal_url}/login",
            require_auth=True,
            output_schema={
                "type": "object",
                "properties": {
                    "confirmation_number": {
                        "type": "string",
                        "description": "The confirmation number from the InsureCo portal, format CLM-XXXXXXXX",
                    },
                    "insure_co_claim_id": {
                        "type": "string",
                        "description": "UUID from the InsureCo claim URL /claims/{UUID}/confirmation",
                    },
                },
                "required": ["confirmation_number"],
            },
        )
    return result["task_id"]


async def poll_yutori_task(task_id: str) -> dict:
    """
    Poll Yutori task status via the official async SDK.
    Returns: {status: "queued|running|succeeded|failed", result: {...}}
    """
    async with AsyncYutoriClient(api_key=settings.yutori_api_key) as client:
        return await client.browsing.get(task_id)


async def create_scout(insure_co_claim_id: str, base_url: str, email: str) -> str:
    """
    Create a Yutori Scout to monitor InsureCo claim approval.
    Returns scout_id.
    """
    async with AsyncYutoriClient(api_key=settings.yutori_api_key) as client:
        # Try with email param first; fall back if not supported
        try:
            result = await client.scouts.create(
                url=f"{base_url}/api/claims/{insure_co_claim_id}",
                query='Check if the JSON field "status" equals "approved". Return true when approved.',
                email=email,
            )
        except TypeError:
            # SDK version may not have email param — use skip_email=False
            result = await client.scouts.create(
                url=f"{base_url}/api/claims/{insure_co_claim_id}",
                query='Check if the JSON field "status" equals "approved". Return true when approved.',
                skip_email=False,
            )
    # Field name may be scout_id or id depending on SDK version
    return result.get("scout_id") or result.get("id") or str(result)


async def poll_scout(scout_id: str) -> dict:
    """Poll a Yutori Scout for its current status."""
    async with AsyncYutoriClient(api_key=settings.yutori_api_key) as client:
        return await client.scouts.get(scout_id)


async def create_submission_node(
    session,
    claim_id: str,
    yutori_task_id: str,
    destination_url: str,
) -> str:
    """Create a Submission node in Neo4j and link it to the Claim."""
    submission_id = str(uuid.uuid4())
    await session.run(
        """
        MATCH (c:Claim {id: $claim_id})
        CREATE (s:Submission {
            id: $submission_id,
            destination_url: $destination_url,
            yutori_task_id: $yutori_task_id,
            confirmation_id: null,
            insure_co_claim_id: null,
            scout_id: null,
            scout_status: null,
            status: 'pending',
            submitted_at: datetime()
        })
        CREATE (c)-[:RESULTED_IN]->(s)
        """,
        claim_id=claim_id,
        submission_id=submission_id,
        destination_url=destination_url,
        yutori_task_id=yutori_task_id,
    )
    return submission_id


async def update_submission_status(
    session,
    yutori_task_id: str,
    status: str,
    confirmation_id: str | None = None,
    insure_co_claim_id: str | None = None,
    scout_id: str | None = None,
) -> None:
    """Update Submission node when Yutori reports task completion."""
    await session.run(
        """
        MATCH (s:Submission {yutori_task_id: $task_id})
        SET s.status = $status,
            s.confirmation_id = $confirmation_id,
            s.insure_co_claim_id = $insure_co_claim_id,
            s.scout_id = $scout_id
        """,
        task_id=yutori_task_id,
        status=status,
        confirmation_id=confirmation_id,
        insure_co_claim_id=insure_co_claim_id,
        scout_id=scout_id,
    )
