from typing import Union
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse
from api.vad_algorithm import process_audio_with_vad, convert_wav_to_pcm
from api.transcription_service import transcribe_audio
from pydub import AudioSegment
from fastapi.middleware.cors import CORSMiddleware
import subprocess
import os

# Function to convert any audio file to WAV using FFmpeg


def convert_to_wav(audio_data: bytes, input_format: str) -> bytes:
    try:
        # Write the input audio file to disk temporarily
        input_file = "input_audio." + input_format
        output_file = "output_audio.wav"
        with open(input_file, 'wb') as f:
            f.write(audio_data)

        # Convert to WAV format using ffmpeg
        subprocess.run(['ffmpeg', '-i', input_file, output_file], check=True)

        # Read the WAV output and return it as bytes
        with open(output_file, 'rb') as f:
            wav_data = f.read()

        # Clean up the temporary files
        os.remove(input_file)
        os.remove(output_file)

        return wav_data
    except subprocess.CalledProcessError as e:
        raise HTTPException(
            status_code=500, detail="Error converting file to WAV")

# Converts a WAV file to PCM format with 16kHz, mono


def convert_to_pcm(input_file, output_file):
    # Load the audio file
    audio = AudioSegment.from_file(input_file, format="wav")

    # Convert to mono and 16kHz (16000 Hz) sample rate
    audio = audio.set_channels(1).set_frame_rate(16000)

    # Export the converted audio in PCM format
    audio.export(output_file, format="wav")


app = FastAPI()

# CORS settings (adjust as needed)
app.add_middleware(
    CORSMiddleware,
    # Replace with your Angular app's URL
    allow_origins=["http://localhost:4200"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Test endpoint to check if the server is running


@app.get("/")
async def read_root():
    return {"Hello": "World"}


@app.post("/vad/")
async def vad_endpoint(audio_file: UploadFile = File(...)):
    # Ensure a valid file is uploaded
    if not audio_file:
        raise HTTPException(status_code=400, detail="No file uploaded")

    # Check content type of uploaded file
    valid_content_types = ["audio/vnd.wav", "audio/x-wav", "audio/mpeg",
                           "audio/mp3", "audio/aac", "audio/wav", "application/octet-stream"]
    if audio_file.content_type not in valid_content_types:
        raise HTTPException(
            status_code=400, detail="Invalid audio format. Please upload a WAV or MP3 file.")

    try:
        # Read audio file
        audio_data = await audio_file.read()
        print(f"Received audio file of size: {len(audio_data)} bytes")

        # Convert audio to WAV format if needed

        # Convert the WAV file to raw PCM format for processing
        pcm_data, sample_rate = convert_wav_to_pcm(audio_data)

        # Process the PCM audio data using Voice Activity Detection (VAD)
        speech_segments = process_audio_with_vad(pcm_data, sample_rate)

        # Return response if no speech segments were detected
        if not speech_segments:
            return {"message": "No speech detected", "speech_segments_count": 0}

        # Transcribe the detected speech segments
        transcription_result = transcribe_audio(speech_segments)
        print(f"Transcription: {transcription_result.strip()}")

        # Return transcription and speech segments count as JSON response
        return JSONResponse(content={"transcription": transcription_result, "speech_segments_count": len(speech_segments)})

    except ValueError as e:
        return {"error": f"Value error occurred: {str(e)}"}

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Server error: {str(e)}")
