using System.Buffers;
using System.Text;
using System.IO.Pipelines;
using System;
using System.Buffers.Text;

namespace CsvParser2
{
    internal class Program
    {
        static async Task<int> Main(string[] args)
        {
            var counter = 1;
            using FileStream fs = new FileStream("file.csv", FileMode.Open, FileAccess.Read);
            using FileStream writer = new FileStream("out.txt", FileMode.Create, FileAccess.Write);
            using StreamWriter writer2 = new StreamWriter(writer);
            await CsvParser6.ParseCsvAsync(fs, (data) =>
            {
                if (data != null)
                {
                    writer2.WriteLine($"{data[0].ToUtf8String()} {data[1].ToUtf8String()} {data[2].ToUtf8String()} {data[3].ToUtf8String()} {data[4].ToUtf8String()} {data[20].ToUtf8String()}");

                }
               
                Console.Write("\r{0}   ", counter++);
            });
            return 0;
        }
    }

    public class CsvParser6
    {
        private static readonly ArrayPool<byte> BytePool = ArrayPool<byte>.Shared;
        private static readonly ArrayPool<(int length, byte[] data)> ColumnPool = ArrayPool<(int length, byte[] data)>.Shared;

        public static async Task ParseCsvAsync(Stream stream, Action<(int length, byte[] data)[]> processLine)
        {
            var columnCount = 23;
            var pipeReader = PipeReader.Create(stream);
            var lineBuffer = ColumnPool.Rent(columnCount); // Temporary char buffer for conversions
            
            try
            {
                var index = 0;
                while (true)
                {
                    ReadResult result = await pipeReader.ReadAsync();
                    ReadOnlySequence<byte> bufferSequence = result.Buffer;                   
                    
                    while (TryReadLine(ref bufferSequence, lineBuffer, ref index))
                    {
                        ProcessLine(lineBuffer, processLine, columnCount);
                        index = 0;
                    }

                    if (result.IsCompleted && index > 0)
                    {
                        ProcessLine(lineBuffer, processLine, columnCount);
                        index = 0;
                    }

                    pipeReader.AdvanceTo(bufferSequence.Start, bufferSequence.End);

                    if (result.IsCompleted)
                    {
                        break;
                    }
                }

             
            }
            finally
            {
                ColumnPool.Return(lineBuffer);
            }
        }


        private static bool TryReadLine(ref ReadOnlySequence<byte> bufferSequence, (int length, byte[] data)[] lineBuffer, ref int index)
        {
            var sequenceReader = new SequenceReader<byte>(bufferSequence);
            try
            {
                while (!sequenceReader.End)
                {
                    if (sequenceReader.TryPeek(out byte currentByte))
                    {
                        if (currentByte == (byte)'\n')
                        {
                            sequenceReader.Advance(1);
                            bufferSequence = bufferSequence.Slice(sequenceReader.Position);
                                                    
                            return true;
                        }
                        else if (currentByte == (byte)'"')
                        {
                            if (GetQuoteData(ref sequenceReader, out byte[] quoteData, out int quoteIndex)) 
                            {
                                lineBuffer[index++] = new (quoteIndex, quoteData);
                            }
                            else
                            {
                                break;
                            }                       
                        }
                        else if (sequenceReader.TryReadToAny(out ReadOnlySpan<byte> bytes, new[] { (byte)',', (byte)'\r' }, true))
                        {
                            var dataLength = AddToBuffer(bytes, out byte[] data);
                            lineBuffer[index++] = new(dataLength, data);
                        }
                        else
                        {
                            break;
                        }
                    }
                }

                bufferSequence = bufferSequence.Slice(bufferSequence.End);
                return false;
            }
            finally
            {

            }
        }

        private static bool GetQuoteData(ref SequenceReader<byte> sequenceReader, out byte[] pooledData, out int bufferIndex)
        {
            bufferIndex = 0;
            pooledData = [0];

            if (sequenceReader.TryPeek(out var quote) && quote == '"')
            { 
                pooledData = BytePool.Rent(256); // Start with an initial size 
                try
                {
                    //readout one char to remove first quote
                    sequenceReader.Advance(1);

                    while (true)
                    {
                        if (sequenceReader.TryReadTo(out ReadOnlySpan<byte> bytes, (byte)'"') && sequenceReader.TryPeek(out byte nextByte))
                        {

                            if (nextByte == '"')
                            {
                                //safe to advance as trypeek is successful 
                                sequenceReader.Advance(1);
                                AddToBuffer(bytes, ref pooledData, ref bufferIndex);
                                continue;
                            }
                            else
                            {
                                //try read next delimiter, so that we are sure read whole column
                                if (sequenceReader.TryRead(out byte deli))
                                {
                                    AddToBuffer(bytes.Slice(0, bytes.Length - 1), ref pooledData, ref bufferIndex);
                                    return true;
                                }
                                else
                                {
                                    break;
                                }

                            }
                        }
                        else
                        {
                            break;
                        }
                    }
                }
                catch
                {
                    BytePool.Return(pooledData);
                    throw;
                }

            }

            return false;
        }

        private static int AddToBuffer(ReadOnlySpan<byte> sequence, out byte[] pooledData)
        {
            int bufferIndex = 0;
            pooledData = BytePool.Rent(sequence.Length); // Start with an initial size 
            try
            {
                AddToBuffer(sequence, ref pooledData, ref bufferIndex);
            }
            catch
            {
                BytePool.Return(pooledData);
                throw;
            }
            return bufferIndex;
        }

        private static void AddToBuffer(ReadOnlySpan<byte> sequence, ref byte[] buffer, ref int index)
        {
           if((index + sequence.Length) > buffer.Length)
            {
                // Resize buffer if necessary
                byte[] newBuffer = BytePool.Rent(buffer.Length * 2);
                Array.Copy(buffer, newBuffer, buffer.Length);
                BytePool.Return(buffer);
                buffer = newBuffer;
            }

           //start writing at 
            var dstSpan = new Span<byte>(buffer, index, buffer.Length-index);
            sequence.CopyTo(dstSpan);            
            index = (index + sequence.Length);
        }

        private static void ProcessLine((int length, byte[] data)[] stringBuffer, Action<(int length, byte[] data)[]> processLine, int columnCount)
        {
            try
            {
                processLine(stringBuffer);
            }
            finally
            {
                for (int i = 0; i < columnCount; i++)
                {
                    if (stringBuffer[i].data != null)
                    {
                        BytePool.Return(stringBuffer[i].data, true);
                    }                   
                }
                ColumnPool.Return(stringBuffer, true);
            }
        }
    }


public static class CsvParser5
    {
        private static readonly ArrayPool<byte> BytePool = ArrayPool<byte>.Shared;
        private static readonly ArrayPool<char> CharPool = ArrayPool<char>.Shared;

        public static async Task ParseCsvAsync(Stream stream, Action<string[]> processLine)
        {
            var pipeReader = PipeReader.Create(stream);
            var charBuffer = CharPool.Rent(1024); // Temporary char buffer for conversions

            try
            {
                while (true)
                {
                    ReadResult result = await pipeReader.ReadAsync();
                    ReadOnlySequence<byte> bufferSequence = result.Buffer;

                    while (TryReadLine(ref bufferSequence, charBuffer, processLine))
                    {
                    }

                    pipeReader.AdvanceTo(bufferSequence.Start, bufferSequence.End);

                    if (result.IsCompleted)
                    {
                        break;
                    }
                }
            }
            finally
            {
                CharPool.Return(charBuffer);
            }
        }

        private static bool TryReadLine(ref ReadOnlySequence<byte> bufferSequence, char[] charBuffer, Action<string[]> processLine)
        {
            var sequenceReader = new SequenceReader<byte>(bufferSequence);
            var byteBuffer = BytePool.Rent(4096);
            int byteIndex = 0;
            bool insideQuotes = false;

            try
            {
                while (!sequenceReader.End)
                {
                    if (sequenceReader.TryRead(out byte currentByte))
                    {
                        byteBuffer[byteIndex++] = currentByte;

                        if (currentByte == '\n' && !insideQuotes)
                        {
                            // Convert byteBuffer to string and process the line
                            int charCount = Encoding.UTF8.GetChars(byteBuffer, 0, byteIndex, charBuffer, 0);
                            string line = new string(charBuffer, 0, charCount);
                            ProcessLine(line, processLine);
                            byteIndex = 0;
                            bufferSequence = bufferSequence.Slice(sequenceReader.Position);
                            return true;
                        }

                        if (currentByte == '"')
                        {
                            // Handle quote characters and escaped quotes
                            if (insideQuotes && sequenceReader.TryPeek(out byte nextByte) && nextByte == '"')
                            {
                                // Skip escaped quote
                                byteBuffer[byteIndex++] = nextByte;
                                sequenceReader.Advance(1);
                            }
                            else
                            {
                                insideQuotes = !insideQuotes;
                            }
                        }
                    }
                }

                bufferSequence = bufferSequence.Slice(bufferSequence.End);
                return false;
            }
            finally
            {
                BytePool.Return(byteBuffer);
            }
        }

        private static void ProcessLine(string line, Action<string[]> processLine)
        {
            var values = new List<string>();
            var stringBuilder = new StringBuilder();
            bool insideQuotes = false;

            for (int i = 0; i < line.Length; i++)
            {
                if (line[i] == '"')
                {
                    if (insideQuotes && i + 1 < line.Length && line[i + 1] == '"')
                    {
                        // Handle escaped quotes
                        stringBuilder.Append('"');
                        i++;
                    }
                    else
                    {
                        insideQuotes = !insideQuotes;
                    }
                }
                else if (line[i] == ',' && !insideQuotes)
                {
                    values.Add(stringBuilder.ToString());
                    stringBuilder.Clear();
                }
                else
                {
                    stringBuilder.Append(line[i]);
                }
            }

            if (stringBuilder.Length > 0)
            {
                values.Add(stringBuilder.ToString());
            }

            processLine(values.ToArray());
        }
    }

    public static class CsvParser4
    {
        private static readonly ArrayPool<char> CharPool = ArrayPool<char>.Shared;

        public static async Task ParseCsvAsync(Stream stream, Action<string[]> processLine)
        {
            var pipeReader = PipeReader.Create(stream);
            var buffer = new StringBuilder();

            while (true)
            {
                ReadResult result = await pipeReader.ReadAsync();
                ReadOnlySequence<byte> bufferSequence = result.Buffer;

                while (TryReadLine(ref bufferSequence, buffer, processLine))
                {
                }

                pipeReader.AdvanceTo(bufferSequence.Start, bufferSequence.End);

                if (result.IsCompleted)
                {
                    break;
                }
            }

            if (buffer.Length > 0)
            {
                ProcessLine(buffer.ToString(), processLine);
            }
        }

        private static bool TryReadLine(ref ReadOnlySequence<byte> bufferSequence, StringBuilder buffer, Action<string[]> processLine)
        {
            var sequenceReader = new SequenceReader<byte>(bufferSequence);
            bool insideQuotes = false;

            while (!sequenceReader.End)
            {
                if (sequenceReader.TryReadTo(out ReadOnlySequence<byte> segment, (byte)'\n'))
                {
                    AddToBuffer(segment, buffer);

                    // Check if the line is complete
                    if (!insideQuotes)
                    {
                        buffer.Append('\n');
                        ProcessLine(buffer.ToString(), processLine);
                        buffer.Clear();
                        bufferSequence = bufferSequence.Slice(sequenceReader.Position);
                        return true;
                    }
                    else
                    {
                        buffer.Append('\n');
                    }
                }
                else
                {
                    // Read to the end if no newline character is found
                    AddToBuffer(sequenceReader.UnreadSequence, buffer);
                    bufferSequence = bufferSequence.Slice(bufferSequence.End);
                    return false;
                }

                // Handle quote characters
                for (int i = 0; i < segment.Length; i++)
                {
                    if (segment.Slice(i, 1).FirstSpan[0] == '"')
                    {
                        // Toggle insideQuotes flag or handle escaped quotes
                        if (insideQuotes && i + 1 < segment.Length && segment.Slice(i + 1, 1).FirstSpan[0] == '"')
                        {
                            i++; // Skip escaped quote
                        }
                        else
                        {
                            insideQuotes = !insideQuotes;
                        }
                    }
                }
            }

            bufferSequence = bufferSequence.Slice(bufferSequence.End);
            return false;
        }

        private static void AddToBuffer(ReadOnlySequence<byte> sequence, StringBuilder buffer)
        {
            foreach (var segment in sequence)
            {
                char[] charBuffer = CharPool.Rent(segment.Length);
                try
                {
                    int charCount = Encoding.UTF8.GetChars(segment.Span, charBuffer);
                    buffer.Append(charBuffer, 0, charCount);
                }
                finally
                {
                    CharPool.Return(charBuffer);
                }
            }
        }

        private static void ProcessLine(string line, Action<string[]> processLine)
        {
            var values = new List<string>();
            var stringBuilder = new StringBuilder();
            bool insideQuotes = false;

            for (int i = 0; i < line.Length; i++)
            {
                if (line[i] == '"')
                {
                    if (insideQuotes && i + 1 < line.Length && line[i + 1] == '"')
                    {
                        // Handle escaped quotes
                        stringBuilder.Append('"');
                        i++;
                    }
                    else
                    {
                        insideQuotes = !insideQuotes;
                    }
                }
                else if (line[i] == ',' && !insideQuotes)
                {
                    values.Add(stringBuilder.ToString());
                    stringBuilder.Clear();
                }
                else
                {
                    stringBuilder.Append(line[i]);
                }
            }

            if (stringBuilder.Length > 0)
            {
                values.Add(stringBuilder.ToString());
            }

            processLine(values.ToArray());
        }
    }


public static class CsvParser3
    {
        private static readonly ArrayPool<char> CharPool = ArrayPool<char>.Shared;

        public static async Task ParseCsvAsync(Stream stream, Action<string[]> processLine)
        {
            var pipeReader = PipeReader.Create(stream);
            var buffer = new StringBuilder();

            while (true)
            {
                ReadResult result = await pipeReader.ReadAsync();
                ReadOnlySequence<byte> bufferSequence = result.Buffer;

                while (TryReadLine(ref bufferSequence, buffer, out bool isComplete))
                {
                    if (isComplete && IsCompleteLine(buffer.ToString()))
                    {
                        ProcessLine(buffer.ToString(), processLine);
                        buffer.Clear();
                    }
                }

                pipeReader.AdvanceTo(bufferSequence.Start, bufferSequence.End);

                if (result.IsCompleted)
                {
                    break;
                }
            }

            if (buffer.Length > 0)
            {
                ProcessLine(buffer.ToString(), processLine);
            }
        }

        private static bool TryReadLine(ref ReadOnlySequence<byte> bufferSequence, StringBuilder buffer, out bool isComplete)
        {
            SequencePosition? position = bufferSequence.PositionOf((byte)'\n');
            isComplete = position != null;

            if (isComplete)
            {
                ReadOnlySequence<byte> lineSequence = bufferSequence.Slice(0, position.Value);
                AddToBuffer(lineSequence, buffer);
                buffer.Append('\n');
                bufferSequence = bufferSequence.Slice(bufferSequence.GetPosition(1, position.Value));
            }
            else
            {
                AddToBuffer(bufferSequence, buffer);
            }

            return isComplete;
        }

        private static void AddToBuffer(ReadOnlySequence<byte> sequence, StringBuilder buffer)
        {
            foreach (var segment in sequence)
            {
                char[] charBuffer = CharPool.Rent(segment.Length);
                try
                {
                    int charCount = Encoding.UTF8.GetChars(segment.Span, charBuffer);
                    buffer.Append(charBuffer, 0, charCount);
                }
                finally
                {
                    CharPool.Return(charBuffer);
                }
            }
        }

        private static bool IsCompleteLine(string line)
        {
            bool insideQuotes = false;
            for (int i = 0; i < line.Length; i++)
            {
                if (line[i] == '"')
                {
                    if (insideQuotes && i + 1 < line.Length && line[i + 1] == '"')
                    {
                        // Skip escaped quote
                        i++;
                    }
                    else
                    {
                        insideQuotes = !insideQuotes;
                    }
                }
            }
            return !insideQuotes;
        }

        private static void ProcessLine(string line, Action<string[]> processLine)
        {
            var values = new List<string>();
            var stringBuilder = new StringBuilder();
            bool insideQuotes = false;

            for (int i = 0; i < line.Length; i++)
            {
                if (line[i] == '"')
                {
                    if (insideQuotes && i + 1 < line.Length && line[i + 1] == '"')
                    {
                        // Handle escaped quotes
                        stringBuilder.Append('"');
                        i++;
                    }
                    else
                    {
                        insideQuotes = !insideQuotes;
                    }
                }
                else if (line[i] == ',' && !insideQuotes)
                {
                    values.Add(stringBuilder.ToString());
                    stringBuilder.Clear();
                }
                else
                {
                    stringBuilder.Append(line[i]);
                }
            }

            if (stringBuilder.Length > 0)
            {
                values.Add(stringBuilder.ToString());
            }

            processLine(values.ToArray());
        }
    }


}



public static class CsvExtensions
{
    public static string ToUtf8String(this (int length, byte[] buffer) item)
    {
        var span = new ReadOnlySpan<byte>(item.buffer, 0, item.length);
        return Encoding.UTF8.GetString(span);
    }
} 
