import speech_recognition as sr
from pydub import AudioSegment
import io


def transcribe_audio(speech_segments):
    recognizer = sr.Recognizer()
    transcription_result = ""
    combined_segment = b""

    min_segment_length = 3200  # Minimum segment length in bytes (~0.1 seconds)

    for i, segment in enumerate(speech_segments):
        combined_segment += segment

        if len(combined_segment) >= min_segment_length:
            try:
                # Convert bytes to audio data
                audio = sr.AudioData(combined_segment, 16000, 2)

                # Transcribe the audio
                chunk_transcription = recognizer.recognize_google(
                    audio, language="en-US")

                # Add the transcription of the current chunk to the final result
                transcription_result += chunk_transcription + " "

                # Print each chunk transcription (optional)
                print(f"Combined segment transcription: {chunk_transcription}")

                # Reset the combined segment
                combined_segment = b""

            except sr.UnknownValueError:
                transcription_result += "[Unintelligible] "
            except sr.RequestError as e:
                transcription_result += f"[API error: {e}] "
                print(
                    f"Could not request results from Google Speech Recognition service; {e}")
            except Exception as e:
                transcription_result += f"[Error: {e}] "
                print(f"Error processing segment {i + 1}: {e}")

    # Return the final accumulated transcription
    return transcription_result.strip()
