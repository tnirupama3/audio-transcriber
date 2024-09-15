import webrtcvad
import wave
from pydub import AudioSegment
import io


def convert_wav_to_pcm(audio_data):
    """
    Converts WAV audio data to raw PCM data.

    Parameters:
    audio_data (bytes): The binary content of the WAV file.

    Returns:
    tuple: A tuple containing raw PCM data (bytes) and the sample rate (int).

    Raises:
    ValueError: If the audio format is invalid (e.g., not mono, not 16-bit, or unsupported sample rate).
    """
    """
    Converts WAV audio data to raw PCM data using pydub for format compatibility.
    """

    try:
        # Use pydub to convert the audio to PCM format
        audio = AudioSegment.from_file(io.BytesIO(audio_data), format="wav")
        audio = audio.set_channels(1).set_sample_width(2).set_frame_rate(16000)

        # Export the audio as raw PCM data
        pcm_data = audio.raw_data
        sample_rate = audio.frame_rate

        print("Channels:", {audio.channels})
        print("pcm_data:", {pcm_data})
        print("sample_rate", {sample_rate})

        return pcm_data, sample_rate

    except Exception as e:
        print(f"Error while converting WAV to PCM: {e}")
        raise


def process_audio_with_vad(pcm_data, sample_rate=16000):
    print("\nEntered function for VAD processing")

    # Initialize the VAD (Voice Activity Detection)
    vad = webrtcvad.Vad()
    vad.set_mode(1)  # 0 to 3, higher value means more aggressive filtering

    # Frame duration in milliseconds and the number of samples per frame
    frame_duration = 30  # 30ms per frame
    # Multiply by 2 for 16-bit audio
    num_samples_per_frame = int(sample_rate * frame_duration / 1000 * 2)

    # List to hold the detected speech segments
    speech_segments = []

    # Loop through the PCM audio data in chunks of the calculated frame size
    for i in range(0, len(pcm_data), num_samples_per_frame):
        frame = pcm_data[i:i + num_samples_per_frame]

        # Pad the frame if it's smaller than the expected size
        if len(frame) < num_samples_per_frame:
            frame += b'\x00' * (num_samples_per_frame - len(frame))

        # Check if the frame contains speech
        try:
            if vad.is_speech(frame, sample_rate):
                speech_segments.append(frame)
        except Exception as e:
            print(f"Error while processing frame: {e}")
            raise ValueError("Error while processing frame")

    # Print the number of detected speech segments
    print(f"Detected {len(speech_segments)} speech segments.")
    return speech_segments
