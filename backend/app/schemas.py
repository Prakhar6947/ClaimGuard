from pydantic import BaseModel, Field
from typing import List, Optional

class LoginRequest(BaseModel):
    email: str
    password: str

class VerifyFieldRequest(BaseModel):
    confirmed_value: Optional[str] = None
    actor_name: str = "Demo Executive"
    actor_role: str = "DESK_EXEC"

class ReassignDocSlotRequest(BaseModel):
    target_slot_key: str
    actor_name: str = "Demo Executive"
    actor_role: str = "DESK_EXEC"

class WaiveChecklistSlotRequest(BaseModel):
    waiver_reason: str = Field(..., min_length=5)
    actor_name: str = "Demo Desk Head"
    actor_role: str = "DESK_HEAD"

class TransitionStatusRequest(BaseModel):
    target_status: str
    actor_name: str = "Demo Executive"
    actor_role: str = "DESK_EXEC"

class QueryReplyRequest(BaseModel):
    reply_text: str = Field(..., min_length=10)
    actor_name: str = "Demo Executive"
    actor_role: str = "DESK_EXEC"

class DoctorSignOffRequest(BaseModel):
    clinical_justification: str = Field(..., min_length=10)
    doctor_name: str

class CreateChecklistRuleRequest(BaseModel):
    insurer_id: Optional[str] = None
    procedure_id: Optional[str] = None
    slot_key: str
    slot_label: str
    stage_required: str = "PRE_AUTH"
    is_mandatory: bool = True
    actor_role: str = "DESK_HEAD"

class CreateClaimRequest(BaseModel):
    patient_name: str = Field(..., min_length=2)
    patient_age: int = Field(..., gt=0, lt=120)
    patient_gender: str = Field(..., min_length=1)
    uhid: str = Field(..., min_length=3)
    ward_bed: str = Field(..., min_length=2)
    policy_number_full: str = Field(..., min_length=6)
    insurer_id: str
    procedure_id: str
    treating_doctor_name: str = Field(..., min_length=3)
    estimated_amount_inr: float = Field(..., gt=0)
    actor_name: str = "Priya Deshpande"
    actor_role: str = "DESK_EXEC"
    assigned_exec_name: Optional[str] = None

class AuditUnmaskRequest(BaseModel):
    actor_name: str = "Demo Executive"
    actor_role: str = "DESK_EXEC"
