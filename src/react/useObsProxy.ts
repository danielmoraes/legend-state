import { isArray, useForceRender } from '@legendapp/tools';
import { listeners } from 'process';
import { useEffect, useRef } from 'react';
import { isPrimitive } from '../globals';
import { listenToObs } from '../ObsProxyFns';
import { MappedProxyValue, ObsListener, ObsProxy, ObsProxyChecker, ObsProxyUnsafe } from '../ObsProxyInterfaces';
import { disposeListener } from '../ObsProxyListener';
import { state } from '../ObsProxyState';

interface SavedRef {
    args?: ObsProxyChecker[];
    primitives?: [ObsProxy, string][];
    listenersArgs?: ObsListener[];
}

function useObsProxy<T extends any[]>(fn: () => T): MappedProxyValue<T> {
    const forceRender = useForceRender();
    const ref = useRef<SavedRef>();
    if (!ref.current) {
        ref.current = {
            listenersArgs: [],
        };
    }

    const prevArgs = ref.current.args;

    state.isTrackingPrimitives = true;

    state.trackedPrimitives = [];
    const args = (ref.current.args = fn());
    const primitives = (ref.current.primitives = state.trackedPrimitives);

    state.isTrackingPrimitives = false;

    // Compare to previous args and update listeners if any changed or first mount
    updateListeners(args, prevArgs, primitives, ref.current.listenersArgs, forceRender);

    // Dispose listeners on unmount
    useEffect(
        () => () => {
            if (ref.current.listenersArgs) {
                ref.current.listenersArgs.forEach(disposeListener);
                ref.current.listenersArgs = [];
            }
        },
        []
    ); // eslint-disable-line react-hooks/exhaustive-deps

    return args.map((obs) => (obs ? (isArray(obs) ? obs[0].get()[obs[1]] : obs.get()) : obs)) as MappedProxyValue<T>;
}

const updateListeners = (
    args: ObsProxyChecker[],
    prevArgs: (ObsProxy | ObsProxyUnsafe)[],
    primitives: [ObsProxy, string][],
    listenersArgs: ObsListener[],
    onChange: () => void
) => {
    const num = Math.max(args.length, prevArgs ? prevArgs.length : 0);
    let indexPrimitive = 0;
    for (let i = 0; i < num; i++) {
        let obs = args[i];
        const prev = prevArgs?.[i];
        let prop: string = undefined;
        if (isPrimitive(obs)) {
            [obs, prop] = args[i] = primitives[indexPrimitive++];
        }
        if (!prevArgs || (prop ? obs !== prev[0] || prop !== prev[1] : obs !== prevArgs[i])) {
            if (listenersArgs[i]) {
                disposeListener(listenersArgs[i]);
                listenersArgs[i] = undefined;
            }

            if (obs) {
                listenersArgs[i] =
                    prop !== undefined ? listenToObs(obs as any, prop, onChange) : listenToObs(obs, onChange);
            }
        }
    }
};

export { useObsProxy };
