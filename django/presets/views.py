from django.shortcuts import render

from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from .models import Preset, SharedPreset
from .serializers import PresetSerializer, SharedPresetSerializer


class SharedPresetView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        shared_presets = (
            SharedPreset.objects.all()
        )  # get list of python objects with query
        serializer = SharedPresetSerializer(
            shared_presets, many=True
        )  # turn them into JSON
        return Response(serializer.data, status=status.HTTP_200_OK)  # send them


class PresetListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user_presets = Preset.objects.filter(user=request.user)  # query user presets
        serializer = PresetSerializer(user_presets, many=True)  # put into json
        return Response(serializer.data, status=status.HTTP_200_OK)  # send it

    def post(self, request):
        serializer = PresetSerializer(data=request.data)  # parse preset
        if serializer.is_valid():
            serializer.save(user=request.user)  # add username
            return Response(  # send it back to frontend
                serializer.data,
                status=status.HTTP_201_CREATED,
            )
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class PresetDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get_object(self, pk, user):
        return Preset.objects.filter(id=pk, user=user).first()

    # update existing preset
    def put(self, request, pk):
        preset_to_update = self.get_object(pk, request.user)

        if preset_to_update is None:
            return Response(
                {"error": "Permission to update is denied"},
                status=status.HTTP_404_NOT_FOUND,
            )

        # serializer is used to update and save preset
        serializer = PresetSerializer(preset_to_update, data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, pk):
        # find preset to delete
        preset_to_delete = self.get_object(pk, request.user)

        # if cant find preset, they are trying to delete something they shouldnt
        if preset_to_delete is None:
            return Response(
                {"error": "Permission to delete is denied"},
                status=status.HTTP_404_NOT_FOUND,
            )

        # actually delete it
        preset_to_delete.delete()

        # send ack that it has been deleted
        return Response(
            {"message": "Preset Deleted"}, status=status.HTTP_204_NO_CONTENT
        )
