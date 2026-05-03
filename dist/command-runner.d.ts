/**
 * Command Runner
 * Reads commands/*.md and executes the appropriate handler.
 * Makes all slash commands operational.
 */
export type CommandName = 'check' | 'status' | 'start' | 'stop' | 'resume' | 'checkpoint' | 'forget' | 'audit' | 'doctor' | 'team';
export interface CommandResult {
    success: boolean;
    output: string;
    error?: string;
}
export declare function runCommand(name: CommandName, args: string[]): Promise<CommandResult>;
export declare function listCommands(): Promise<string[]>;
//# sourceMappingURL=command-runner.d.ts.map