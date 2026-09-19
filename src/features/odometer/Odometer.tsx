import React from "react";
import "./Odometer.css";

interface OdometerProps {
    start: number;
    end: number;
    height: number;
    width: number;
    labelText?: string | undefined;
    labelSize?: number | undefined;
}

const Odometer: React.FC<OdometerProps> = ({
    end,
    height,
    width,
    labelText,
}) => {
    const isNegative = end < 0;
    const absEnd = isNaN(end) ? 0 : Math.abs(end);
    const endArray = Array.from(String(absEnd), String);

    return (
        <div className="odometer">
            {isNegative && (
                <span
                    className="font-semibold text-zinc-900 select-none"
                    style={{
                        height: `${height}px`,
                        lineHeight: `${height}px`,
                        fontSize: `${height}px`,
                    }}
                >
                    -
                </span>
            )}
            {labelText && (
                <span
                    className="font-semibold text-zinc-900 select-none"
                    style={{
                        height: `${height}px`,
                        lineHeight: `${height}px`,
                        fontSize: `${height}px`,
                    }}
                >
                    {labelText}
                </span>
            )}
            <div className="flex items-start">
                {endArray.map((digitChar, index) => {
                    const digitVal = parseInt(digitChar);
                    // Safe guard: if NaN, less than 0, or greater than 9, default to 0 (renders digit "0").
                    const safeDigitVal = isNaN(digitVal) || digitVal < 0 || digitVal > 9 ? 0 : digitVal;
                    const offset = (safeDigitVal + 1) * height;

                    return (
                        <React.Fragment key={index}>
                            <div
                                className="odometer-digit"
                                style={{
                                    width: `${width}px`,
                                    height: `${height}px`,
                                }}>
                                <div
                                    className="odometer-digit-inner"
                                    style={{
                                        transform: `translateY(-${offset}px)`,
                                    }}>
                                    {[" ", ...Array.from(Array(10).keys(), String)].map(
                                        (digit) => (
                                            <span
                                                style={{
                                                    height: `${height}px`,
                                                    lineHeight: `${height}px`,
                                                    fontSize: `${height}px`,
                                                }}
                                                key={digit}>
                                                {digit}
                                            </span>
                                        )
                                    )}
                                </div>
                            </div>
                            {/* Insert comma separator every 3rd digit from the right, not on the last digit */}
                            {(endArray.length - 1 - index) % 3 === 0 && index !== endArray.length - 1 && (
                                <span
                                    className="font-bold text-zinc-800 select-none"
                                    style={{
                                        fontSize: `${height * 0.75}px`,
                                        lineHeight: `${height}px`,
                                        margin: "0 1px",
                                    }}>
                                    ,
                                </span>
                            )}
                        </React.Fragment>
                    );
                })}
            </div>
        </div>
    );
};

export default Odometer;


