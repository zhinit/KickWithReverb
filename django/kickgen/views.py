import uuid
from datetime import datetime, time

from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from supabase import create_client

from django.conf import settings
from .models import GeneratedKick
from presets.models import Preset
from .german_names import generate_kick_name

DAILY_GEN_LIMIT = 10
TOTAL_GEN_CAP = 30
EST_OFFSET = timezone.timedelta(hours=-5)


def get_midnight_est():
    now_est = timezone.now() + EST_OFFSET
    midnight_est = datetime.combine(now_est.date(), time.min, tzinfo=now_est.tzinfo)
    return midnight_est - EST_OFFSET


def get_user_counts(user):
    gens_total = GeneratedKick.objects.filter(user=user).count()
    today_midnight = get_midnight_est()
    gens_today = GeneratedKick.objects.filter(
        user=user, created_at__gte=today_midnight
    ).count()
    return gens_total, gens_today


class GenerateKickView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        gens_total, gens_today = get_user_counts(request.user)

        if gens_total >= TOTAL_GEN_CAP:
            return Response(
                {
                    "error": f"Delete kicks to generate more ({gens_total}/{TOTAL_GEN_CAP})"
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        if gens_today >= DAILY_GEN_LIMIT:
            return Response(
                {"error": f"Daily generation limit reached {DAILY_GEN_LIMIT}"},
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )

        # call modal worker
        import modal
        KickGenerator = modal.Cls.from_name("kick-generator-app", "KickGenerator")
        wav_bytes = KickGenerator().generate_kick.remote("hit house")

        # Upload to Supabase Storage
        file_id = str(uuid.uuid4())
        storage_path = f"{request.user.id}/{file_id}.wav"
        sb = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_KEY)
        sb.storage.from_("generated-kicks").upload(
            storage_path, wav_bytes, {"content-type": "audio/wav"}
        )
        audio_url = f"{settings.SUPABASE_URL}/storage/v1/object/public/generated-kicks/{storage_path}"

        # get german file name
        existing_names = list(
            GeneratedKick.objects.filter(user=request.user).values_list(
                "name", flat=True
            )
        )
        name = generate_kick_name(existing_names)

        # save record
        kick = GeneratedKick.objects.create(
            user=request.user,
            name=name,
            audio_url=audio_url,
            storage_path=storage_path,
        )

        gens_total += 1
        gens_today += 1

        return Response(
            {
                "id": kick.id,
                "name": kick.name,
                "audio_url": kick.audio_url,
                "remaining_gens_today": DAILY_GEN_LIMIT - gens_today,
                "total_gens_count": gens_total,
            },
            status=status.HTTP_201_CREATED,
        )


class KickListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        kicks = GeneratedKick.objects.filter(user=request.user)
        gens_total, gens_today = get_user_counts(request.user)

        return Response(
            {
                "kicks": [
                    {"id": k.id, "name": k.name, "audio_url": k.audio_url}
                    for k in kicks
                ],
                "remaining_gens_today": DAILY_GEN_LIMIT - gens_today,
                "total_gens_count": gens_total,
            }
        )


class KickDeleteView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request, pk):
        kick = GeneratedKick.objects.filter(id=pk, user=request.user).first()
        if not kick:
            return Response(
                {"error": "Kick not found"},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Check if any presets reference this kick
        affected_presets = Preset.objects.filter(
            user=request.user, kick_sample=kick.name
        )

        if affected_presets.exists() and request.query_params.get("confirm") != "true":
            return Response(
                {
                    "error": "Presets will be deleted",
                    "presets": list(
                        affected_presets.values_list("preset_name", flat=True)
                    ),
                },
                status=status.HTTP_409_CONFLICT,
            )

        # Delete from Supabase Storage
        sb = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_KEY)
        sb.storage.from_("generated-kicks").remove([kick.storage_path])

        # Delete affected presets and the kick
        affected_presets.delete()
        kick.delete()

        gens_total = GeneratedKick.objects.filter(user=request.user).count()

        return Response(
            {"total_count": gens_total},
            status=status.HTTP_200_OK,
        )
