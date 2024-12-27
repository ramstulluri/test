using System.Buffers;
using System.IO.Pipelines;
using System.Text;

public static class CsvParser
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
        int quoteCount = 0;
        foreach (char c in line)
        {
            if (c == '"')
            {
                quoteCount++;
            }
        }
        return quoteCount % 2 == 0;
    }

    private static void ProcessLine(string line, Action<string[]> processLine)
    {
        var values = new List<string>();
        var stringBuilder = new StringBuilder();
        bool insideQuotes = false;

        foreach (char c in line)
        {
            if (c == '"')
            {
                insideQuotes = !insideQuotes;
            }
            else if (c == ',' && !insideQuotes)
            {
                values.Add(stringBuilder.ToString());
                stringBuilder.Clear();
            }
            else
            {
                stringBuilder.Append(c);
            }
        }

        if (stringBuilder.Length > 0)
        {
            values.Add(stringBuilder.ToString());
        }

        processLine(values.ToArray());
    }
}
