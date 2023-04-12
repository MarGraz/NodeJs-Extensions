using System;
using System.Diagnostics;
using System.Threading;

namespace Lombiq.NodeJs.Extensions.CustomExecTasks;

public class SharedMutex
    : ICustomMutex
{
    private readonly string _mutexName;
    private readonly TimeSpan _timeout;

    public int RetryIntervalMs { get; set; } = 100;

    public SharedMutex(string mutexName, TimeSpan timeout)
    {
        _mutexName = mutexName;
        _timeout = timeout;
    }

    public bool Execute(Func<bool> functionToExecute, Action<string, object[]> logWait, Action<string, object[]> logError)
    {
        var count = 1;
        var stopwatch = Stopwatch.StartNew();
        using var mutex = new Mutex(initiallyOwned: false, _mutexName);
        while (!mutex.WaitOne(0))
        {
            logWait?.Invoke("#{0} Waiting for shared access to {1}.", new object[] { count++, _mutexName });

            Thread.Sleep(RetryIntervalMs);

            if (stopwatch.Elapsed > _timeout)
            {
                logError?.Invoke("Failed to acquire {0} in {1}.", new object[] { _mutexName, _timeout });
                return false;
            }
        }

        logWait?.Invoke("Acquired shared access to {0} in {1}.", new object[] { _mutexName, stopwatch.Elapsed });

        // Release the mutex asap because we don't need it for execution. We only needed it to check whether it is
        // currently not "locked", i.e. in exclusive usage.
        mutex.ReleaseMutex();

        return functionToExecute();
    }
}
